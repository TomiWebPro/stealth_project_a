"""Publish ceremony, Ver_NNN mapping and immutable receipt tests."""

from __future__ import annotations

import json
from uuid import uuid4

from .conftest import PREFIX
from app.tree import (
    parse_published_version,
    parse_version_folder,
    published_name,
    version_folder,
)


def _project(client, name="Publish Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _write_source(settings, key="hero.png", data=b"original-bytes"):
    target = settings.upload_dir / key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target


def _register(client, project_id, key="hero.png", **overrides):
    payload = {
        "project_id": project_id,
        "type": "image",
        "name": "Hero",
        "storage": {
            "backend": "local",
            "key": key,
            "size_bytes": 1024,
            "content_type": "image/png",
        },
        **overrides,
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201
    return response.json()


def _publish(client, asset_id, comment="Approved"):
    return client.post(
        f"{PREFIX}/assets/{asset_id}/publish", json={"comment": comment}
    )


# --- Helpers ----------------------------------------------------------------


def test_version_mapping_helpers():
    assert version_folder(3) == "Ver_003"
    assert parse_version_folder("Ver_003") == 3
    assert parse_version_folder("nope") is None
    assert published_name("hero.png", 3) == "hero_v003.png"
    assert parse_published_version("hero_v003.png") == 3
    assert parse_published_version("hero.png") is None


# --- Publish ----------------------------------------------------------------


def test_publish_creates_copy_and_receipt(client, settings):
    project = _project(client)
    _write_source(settings)
    asset = _register(client, project["id"])
    assert client.post(f"{PREFIX}/projects/{project['id']}/tree").status_code == 201

    response = _publish(client, asset["id"], comment="Hero approved")
    assert response.status_code == 201
    receipt = response.json()
    assert receipt["version"] == 1
    assert receipt["version_folder"] == "Ver_001"
    assert receipt["comment"] == "Hero approved"
    assert len(receipt["checksum_sha256"]) == 64

    published = settings.studio_root / receipt["published_path"]
    assert published.is_file()
    assert published.name == "hero_v001.png"
    assert published.read_bytes() == b"original-bytes"
    assert parse_published_version(published.name) == 1

    sidecar = settings.studio_root / (receipt["published_path"] + ".publish.json")
    assert sidecar.is_file()
    assert json.loads(sidecar.read_text())["checksum_sha256"] == receipt["checksum_sha256"]

    stored = client.get(f"{PREFIX}/assets/{asset['id']}").json()
    assert stored["metadata"]["publish_receipt"]["version_folder"] == "Ver_001"
    assert client.get(f"{PREFIX}/assets/{asset['id']}/publish").json() == receipt


def test_publish_is_idempotent(client, settings):
    project = _project(client)
    _write_source(settings)
    asset = _register(client, project["id"])
    client.post(f"{PREFIX}/projects/{project['id']}/tree")
    first = _publish(client, asset["id"]).json()
    second = _publish(client, asset["id"]).json()
    assert first == second


def test_publish_rejects_changed_bytes(client, settings):
    project = _project(client)
    _write_source(settings)
    asset = _register(client, project["id"])
    client.post(f"{PREFIX}/projects/{project['id']}/tree")
    first = _publish(client, asset["id"]).json()

    _write_source(settings, data=b"tampered-bytes")
    response = _publish(client, asset["id"])
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "publish_conflict"
    published = settings.studio_root / first["published_path"]
    assert published.read_bytes() == b"original-bytes"  # immutable


def test_version_bump_maps_to_new_folder(client, settings):
    project = _project(client)
    _write_source(settings, "hero.png", b"v1")
    asset = _register(client, project["id"])
    client.post(f"{PREFIX}/projects/{project['id']}/tree")
    first = _publish(client, asset["id"]).json()

    _write_source(settings, "hero_v2.png", b"v2")
    new_version = client.post(
        f"{PREFIX}/assets/{asset['id']}/versions",
        json={
            "storage": {
                "backend": "local",
                "key": "hero_v2.png",
                "size_bytes": 2,
                "content_type": "image/png",
            }
        },
    )
    assert new_version.status_code == 201
    assert new_version.json()["version"] == 2

    second = _publish(client, asset["id"], comment="V2 approved").json()
    assert second["version"] == 2
    assert second["version_folder"] == "Ver_002"
    assert second["published_path"] != first["published_path"]
    assert "Ver_002" in second["published_path"]


def test_publish_missing_source(client):
    project = _project(client)
    asset = _register(client, project["id"], key="does-not-exist.png")
    response = _publish(client, asset["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "publish_source_missing"


def test_publish_path_traversal_rejected(client):
    project = _project(client)
    asset = _register(client, project["id"], key="../outside.png")
    response = _publish(client, asset["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "publish_source_missing"


def test_publish_deleted_asset(client, settings):
    project = _project(client)
    _write_source(settings)
    asset = _register(client, project["id"])
    assert client.delete(f"{PREFIX}/assets/{asset['id']}").status_code == 204
    response = _publish(client, asset["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "asset_deleted"


def test_receipt_before_publish(client):
    project = _project(client)
    asset = _register(client, project["id"])
    response = client.get(f"{PREFIX}/assets/{asset['id']}/publish")
    assert response.status_code == 404
