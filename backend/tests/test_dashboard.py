"""Authoritative dashboard summary endpoint tests (success + failure paths)."""

from __future__ import annotations

from typing import get_args

from app.schemas.asset import AssetType
from app.schemas.operation import JobStatus

from .conftest import PREFIX


def _project(client, name):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def _asset(client, project_id, name, *, asset_type="image", tags=None):
    payload = {
        "project_id": project_id,
        "type": asset_type,
        "name": name,
        "storage": {
            "backend": "local",
            "key": f"Output/{name}.png",
            "size_bytes": 0,
            "content_type": "image/png",
        },
        "tags": tags or [],
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _conversation(client, project_id, title):
    response = client.post(
        f"{PREFIX}/projects/{project_id}/conversations", json={"title": title}
    )
    assert response.status_code == 201, response.text
    return response.json()


def _job(client, project_id):
    spec = client.get(f"{PREFIX}/operations").json()["operations"][0]
    response = client.post(
        f"{PREFIX}/jobs",
        json={
            "operation_id": spec["id"],
            "schema_version": spec["schema_version"],
            "project_id": project_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _enabled_extension(client):
    response = client.post(
        f"{PREFIX}/extensions/install",
        json={
            "extension_id": "com.studio.blender-export",
            "accepted_permissions": ["assets.read", "storage.write"],
        },
    )
    assert response.status_code == 201, response.text
    extension_id = response.json()["extension_id"]
    enabled = client.post(f"{PREFIX}/extensions/{extension_id}/enable")
    assert enabled.status_code == 200, enabled.text
    return extension_id


def _dashboard(client, **params):
    return client.get(f"{PREFIX}/dashboard", params=params)


def test_dashboard_empty_workspace(client):
    response = _dashboard(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == {
        "counts",
        "generated_at",
        "jobs_by_status",
        "assets_by_type",
        "recent_jobs",
        "recent_assets",
    }
    providers = client.get(f"{PREFIX}/providers").json()
    assert body["counts"] == {
        "projects": 0,
        "assets": 0,
        "conversations": 0,
        "jobs": 0,
        "providers": len(providers),
        "enabled_extensions": 0,
    }
    assert body["jobs_by_status"] == {status: 0 for status in get_args(JobStatus)}
    assert body["assets_by_type"] == {asset_type: 0 for asset_type in get_args(AssetType)}
    assert body["recent_jobs"] == []
    assert body["recent_assets"] == []
    assert body["generated_at"]


def test_dashboard_counts_breakdowns_and_enabled_extensions(client):
    first = _project(client, "First")
    _project(client, "Second")
    _asset(client, first["id"], "Concept")
    _asset(client, first["id"], "Frame", asset_type="video")
    _asset(client, first["id"], "Texture", asset_type="texture")
    _conversation(client, first["id"], "Chat")
    _conversation(client, first["id"], "Notes")
    job = _job(client, first["id"])
    _job(client, first["id"])
    canceled = client.post(f"{PREFIX}/jobs/{job['id']}/cancel", json={})
    assert canceled.status_code == 200, canceled.text
    _enabled_extension(client)

    body = _dashboard(client).json()
    assert body["counts"] == {
        "projects": 2,
        "assets": 3,
        "conversations": 2,
        "jobs": 2,
        "providers": len(client.get(f"{PREFIX}/providers").json()),
        "enabled_extensions": 1,
    }
    assert body["jobs_by_status"]["queued"] == 1
    assert body["jobs_by_status"]["canceled"] == 1
    assert body["assets_by_type"]["image"] == 1
    assert body["assets_by_type"]["video"] == 1
    assert body["assets_by_type"]["texture"] == 1
    assert sum(body["jobs_by_status"].values()) == 2
    assert sum(body["assets_by_type"].values()) == 3


def test_dashboard_recent_items_are_newest_first_and_bounded(client):
    project = _project(client, "Recency")
    for index in range(4):
        _asset(client, project["id"], f"Asset {index}")
        _job(client, project["id"])

    body = _dashboard(client, recent_limit=2).json()
    assert len(body["recent_assets"]) == 2
    assert len(body["recent_jobs"]) == 2

    all_assets = client.get(f"{PREFIX}/assets", params={"project_id": project["id"]}).json()
    all_jobs = client.get(f"{PREFIX}/jobs", params={"project_id": project["id"]}).json()
    assert [item["id"] for item in body["recent_assets"]] == [
        item["id"] for item in all_assets[:2]
    ]
    assert [item["id"] for item in body["recent_jobs"]] == [item["id"] for item in all_jobs[:2]]


def test_dashboard_excludes_deleted_assets(client):
    project = _project(client, "Cleanup")
    keep = _asset(client, project["id"], "Keep")
    drop = _asset(client, project["id"], "Drop")

    before = _dashboard(client).json()
    assert before["counts"]["assets"] == 2
    assert before["assets_by_type"]["image"] == 2
    assert {item["id"] for item in before["recent_assets"]} == {keep["id"], drop["id"]}

    deleted = client.delete(f"{PREFIX}/assets/{drop['id']}")
    assert deleted.status_code == 204

    after = _dashboard(client).json()
    assert after["counts"]["assets"] == 1
    assert after["assets_by_type"]["image"] == 1
    assert [item["id"] for item in after["recent_assets"]] == [keep["id"]]


def test_dashboard_validation_errors_use_envelope(client):
    for params in ({"recent_limit": 0}, {"recent_limit": 51}, {"recent_limit": "abc"}):
        response = _dashboard(client, **params)
        assert response.status_code == 422, params
        body = response.json()
        assert set(body) == {"error"}
        error = body["error"]
        assert error["code"] == "validation_error"
        assert error["message"]
        assert error["request_id"] == response.headers["X-Request-ID"]
