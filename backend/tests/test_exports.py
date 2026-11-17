"""Engine export path endpoint tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX
from app.exports import basename, slug


def _project(client, name="Export Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _asset(client, project_id, key, asset_type="image"):
    payload = {
        "project_id": project_id,
        "type": asset_type,
        "name": "Hero",
        "storage": {
            "backend": "local",
            "key": key,
            "size_bytes": 0,
            "content_type": "application/octet-stream",
        },
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201
    return response.json()


def test_slug_and_basename_helpers():
    assert slug("Campaign One!") == "campaign_one"
    assert slug("***") == "asset"
    assert basename("Assets/Char/Hero_v003.png") == "Hero"
    assert basename("hero.png") == "hero"


def test_project_exports_only_published(client):
    project = _project(client, "Campaign One")
    working = _asset(client, project["id"], "Assets/Char/Hero/Ver_001/Output/hero.png")
    published = _asset(
        client,
        project["id"],
        "Assets/Char/Hero/Ver_001/Dataset/Publish/hero_v001.png",
        asset_type="splat",
    )

    rows = client.get(f"{PREFIX}/projects/{project['id']}/exports").json()
    assert [row["asset_id"] for row in rows] == [published["id"]]
    assert working["id"] not in [row["asset_id"] for row in rows]

    row = rows[0]
    assert row["asset_name"] == "Hero"
    unreal = next(target for target in row["targets"] if target["target"] == "unreal")
    blender = next(target for target in row["targets"] if target["target"] == "blender")
    assert unreal["path"] == "Content/Studio/campaign_one/Splat/hero_v1"
    assert blender["path"] == "//exports/campaign_one/Splat/hero_v1"
    assert unreal["ready"] is True  # splat is Unreal-ready
    assert blender["ready"] is True  # splat is Blender-ready


def test_readiness_by_asset_type(client):
    project = _project(client)
    video = _asset(client, project["id"], "Assets/Publish/clip_v001.mp4", asset_type="video")
    row = client.get(f"{PREFIX}/assets/{video['id']}/exports").json()[0]
    targets = {item["target"]: item for item in row["targets"]}
    assert targets["unreal"]["ready"] is True
    assert targets["blender"]["ready"] is False
    assert targets["unreal"]["source_exists"] is False  # no bytes on disk


def test_asset_exports_empty_and_missing(client):
    project = _project(client)
    working = _asset(client, project["id"], "Output/hero.png")
    assert client.get(f"{PREFIX}/assets/{working['id']}/exports").json() == []
    assert client.get(f"{PREFIX}/assets/{uuid4()}/exports").status_code == 404


def test_project_exports_missing_project(client):
    response = client.get(f"{PREFIX}/projects/{uuid4()}/exports")
    assert response.status_code == 404
