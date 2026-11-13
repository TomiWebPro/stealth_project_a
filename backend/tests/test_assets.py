"""Asset library, lineage, version and content tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX


def _create_project(client, archived=False):
    response = client.post(f"{PREFIX}/projects", json={"name": "Asset Project"})
    assert response.status_code == 201
    project = response.json()
    if archived:
        client.delete(f"{PREFIX}/projects/{project['id']}")
    return project


def _storage_ref(
    *,
    key="image.png",
    content_type="image/png",
    size_bytes=1024,
    backend="local",
    url=None,
):
    return {
        "backend": backend,
        "key": key,
        "size_bytes": size_bytes,
        "content_type": content_type,
        "etag": None,
        "url": url,
        "bucket": None,
    }


def _register(
    client,
    project_id,
    *,
    name="Image",
    asset_type="image",
    tags=None,
    storage=None,
    parent_ids=None,
    headers=None,
):
    payload = {
        "project_id": project_id,
        "type": asset_type,
        "name": name,
        "storage": storage or _storage_ref(),
        "tags": tags or [],
        "parent_asset_ids": parent_ids or [],
    }
    return client.post(
        f"{PREFIX}/assets/register", json=payload, headers=headers or {}
    )


def test_register_and_get_asset(client, settings):
    project = _create_project(client)
    response = _register(
        client,
        project["id"],
        name="Portrait",
        tags=["portrait", "4k"],
    )
    assert response.status_code == 201
    asset = response.json()
    assert asset["name"] == "Portrait"
    assert asset["status"] == "ready"
    assert asset["version"] == 1
    assert asset["tags"] == ["portrait", "4k"]
    assert asset["creator_id"] == str(settings.default_user_id)
    assert asset["type"] == "image"
    assert asset["storage"]["key"] == "image.png"
    assert asset["parent_asset_ids"] == []

    fetched = client.get(f"{PREFIX}/assets/{asset['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == asset


def test_register_uses_x_user_id(client):
    project = _create_project(client)
    user_id = str(uuid4())
    asset = _register(
        client, project["id"], headers={"X-User-Id": user_id}
    ).json()
    assert asset["creator_id"] == user_id


def test_register_with_invalid_type(client):
    project = _create_project(client)
    response = _register(
        client, project["id"], asset_type="hologram"
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_get_missing_asset(client):
    response = client.get(f"{PREFIX}/assets/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "asset_not_found"


def test_register_in_archived_project_rejected(client):
    project = _create_project(client, archived=True)
    response = _register(client, project["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "project_archived"


def test_list_asset_filters(client):
    project = _create_project(client)
    _register(client, project["id"], name="Blue Sky", tags=["sky"], asset_type="image")
    _register(client, project["id"], name="Red Sunset", tags=["sky"], asset_type="image")
    _register(client, project["id"], name="Clip", tags=["film"], asset_type="video")

    all_assets = client.get(f"{PREFIX}/assets").json()
    assert {entry["name"] for entry in all_assets} == {
        "Blue Sky",
        "Red Sunset",
        "Clip",
    }

    images = client.get(f"{PREFIX}/assets", params={"type": "image"}).json()
    assert {entry["name"] for entry in images} == {"Blue Sky", "Red Sunset"}

    tagged = client.get(f"{PREFIX}/assets", params={"tag": "sky"}).json()
    assert {entry["name"] for entry in tagged} == {"Blue Sky", "Red Sunset"}

    searched = client.get(f"{PREFIX}/assets", params={"search": "red"}).json()
    assert [entry["name"] for entry in searched] == ["Red Sunset"]

    project_filtered = client.get(
        f"{PREFIX}/assets", params={"project_id": project["id"]}
    ).json()
    assert len(project_filtered) == 3

    other = client.get(
        f"{PREFIX}/assets", params={"project_id": str(uuid4())}
    ).json()
    assert other == []


def test_list_limit(client):
    project = _create_project(client)
    first = _register(client, project["id"], name="A").json()
    second = _register(client, project["id"], name="B").json()
    third = _register(client, project["id"], name="C").json()

    page = client.get(f"{PREFIX}/assets", params={"limit": 2}).json()
    assert len(page) == 2

    next_page = client.get(
        f"{PREFIX}/assets", params={"limit": 2, "cursor": page[-1]["id"]}
    ).json()
    assert len(next_page) == 1

    seen = {entry["id"] for entry in page + next_page}
    assert seen == {first["id"], second["id"], third["id"]}

    empty = client.get(
        f"{PREFIX}/assets", params={"cursor": next_page[-1]["id"]}
    ).json()
    assert empty == []


def test_list_invalid_cursor(client):
    project = _create_project(client)
    _register(client, project["id"], name="A")
    response = client.get(f"{PREFIX}/assets", params={"cursor": str(uuid4())})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_cursor"


def test_update_asset(client):
    project = _create_project(client)
    asset = _register(client, project["id"], name="Old").json()

    response = client.patch(
        f"{PREFIX}/assets/{asset['id']}",
        json={"name": "New", "tags": ["tagged"], "metadata": {"rating": 5}},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "New"
    assert updated["tags"] == ["tagged"]
    assert updated["metadata"] == {"rating": 5}


def test_update_deleted_asset_rejected(client):
    project = _create_project(client)
    asset = _register(client, project["id"]).json()
    client.delete(f"{PREFIX}/assets/{asset['id']}")
    response = client.patch(
        f"{PREFIX}/assets/{asset['id']}", json={"name": "Nope"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "asset_deleted"


def test_soft_delete_lifecycle(client):
    project = _create_project(client)
    asset = _register(client, project["id"], name="Doomed").json()
    asset_id = asset["id"]

    response = client.delete(f"{PREFIX}/assets/{asset_id}")
    assert response.status_code == 204

    fetched = client.get(f"{PREFIX}/assets/{asset_id}").json()
    assert fetched["status"] == "deleted"

    listed = client.get(f"{PREFIX}/assets").json()
    assert asset_id not in {entry["id"] for entry in listed}

    with_deleted = client.get(
        f"{PREFIX}/assets", params={"include_deleted": "true"}
    ).json()
    assert asset_id in {entry["id"] for entry in with_deleted}

    download = client.get(f"{PREFIX}/assets/{asset_id}/download")
    assert download.status_code == 404


def test_soft_delete_is_idempotent(client):
    project = _create_project(client)
    asset = _register(client, project["id"]).json()
    assert client.delete(f"{PREFIX}/assets/{asset['id']}").status_code == 204
    assert client.delete(f"{PREFIX}/assets/{asset['id']}").status_code == 204
    assert client.get(f"{PREFIX}/assets/{asset['id']}").json()["status"] == "deleted"


def test_content_unavailable_for_deleted_asset(client):
    project = _create_project(client)
    asset = _register(client, project["id"]).json()
    client.delete(f"{PREFIX}/assets/{asset['id']}")
    response = client.get(f"{PREFIX}/assets/{asset['id']}/content")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "asset_not_found"


def test_lineage_diamond_visits_shared_ancestor_once(client):
    project = _create_project(client)
    root = _register(client, project["id"], name="Root").json()
    left = _register(
        client, project["id"], name="Left", parent_ids=[root["id"]]
    ).json()
    right = _register(
        client, project["id"], name="Right", parent_ids=[root["id"]]
    ).json()
    leaf = _register(
        client,
        project["id"],
        name="Leaf",
        parent_ids=[left["id"], right["id"]],
    ).json()

    lineage = client.get(
        f"{PREFIX}/assets/{leaf['id']}/lineage", params={"depth": 5}
    ).json()
    node_ids = [node["asset_id"] for node in lineage["nodes"]]
    assert node_ids.count(root["id"]) == 1
    assert set(node_ids) == {leaf["id"], left["id"], right["id"], root["id"]}


def test_versions(client):
    project = _create_project(client)
    asset = _register(client, project["id"]).json()
    versions = client.get(f"{PREFIX}/assets/{asset['id']}/versions").json()
    assert len(versions) == 1
    assert versions[0]["version"] == 1
    assert versions[0]["asset_id"] == asset["id"]


def test_relationships_and_lineage(client):
    project = _create_project(client)
    parent_a = _register(client, project["id"], name="Parent A").json()
    parent_b = _register(client, project["id"], name="Parent B").json()
    child = _register(
        client,
        project["id"],
        name="Child",
        parent_ids=[parent_a["id"], parent_b["id"]],
    ).json()

    relationships = client.get(
        f"{PREFIX}/assets/{child['id']}/relationships"
    ).json()
    assert len(relationships) == 2
    targets = {relationship["to_asset_id"] for relationship in relationships}
    assert targets == {parent_a["id"], parent_b["id"]}
    assert all(relationship["type"] == "derived_from" for relationship in relationships)

    typed = client.get(
        f"{PREFIX}/assets/{child['id']}/relationships", params={"type": "related_to"}
    ).json()
    assert typed == []

    lineage = client.get(
        f"{PREFIX}/assets/{child['id']}/lineage", params={"depth": 2}
    ).json()
    assert lineage["root_asset_id"] == child["id"]
    nodes_by_id = {node["asset_id"]: node for node in lineage["nodes"]}
    assert nodes_by_id[child["id"]]["depth"] == 0
    assert nodes_by_id[parent_a["id"]]["depth"] == 1
    assert nodes_by_id[parent_b["id"]]["depth"] == 1

    shallow = client.get(
        f"{PREFIX}/assets/{child['id']}/lineage", params={"depth": 0}
    ).json()
    assert [node["asset_id"] for node in shallow["nodes"]] == [child["id"]]


def test_lineage_missing_parent_rejected(client):
    project = _create_project(client)
    missing = str(uuid4())
    response = _register(client, project["id"], parent_ids=[missing])
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "asset_not_found"


def test_lineage_missing_asset(client):
    response = client.get(f"{PREFIX}/assets/{uuid4()}/lineage")
    assert response.status_code == 404


def test_download_ticket_and_local_content(client, settings):
    project = _create_project(client)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    (settings.upload_dir / "raw.bin").write_bytes(b"\x00\x01content")

    asset = _register(
        client,
        project["id"],
        storage=_storage_ref(key="raw.bin", content_type="application/octet-stream"),
    ).json()

    ticket = client.get(f"{PREFIX}/assets/{asset['id']}/download").json()
    assert ticket["url"].startswith("http")
    assert ticket["expires_at"]

    content = client.get(ticket["url"])
    assert content.status_code == 200
    assert content.content == b"\x00\x01content"
    assert content.headers["content-type"] == "application/octet-stream"


def test_local_content_unavailable(client, settings):
    project = _create_project(client)
    asset = _register(
        client,
        project["id"],
        storage=_storage_ref(key="missing.png"),
    ).json()
    response = client.get(f"{PREFIX}/assets/{asset['id']}/content")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "asset_content_unavailable"


def test_signed_url_redirects_for_content(client):
    project = _create_project(client)
    asset = _register(
        client,
        project["id"],
        storage=_storage_ref(url="https://cdn.example/asset.bin"),
    ).json()
    response = client.get(f"{PREFIX}/assets/{asset['id']}/content", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "https://cdn.example/asset.bin"