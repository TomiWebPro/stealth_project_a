"""Authoritative asset version-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from app.schemas.asset import AssetVersion, StorageRef
from app.schemas.common import utcnow
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "asset_id",
    "project_id",
    "project_name",
    "asset_name",
    "asset_type",
    "version",
    "created_by",
    "created_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/versions/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Version Feed Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _storage():
    return {"key": "asset.png", "size_bytes": 16, "content_type": "image/png"}


def _asset(client, project_id, name="Asset"):
    response = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project_id,
            "type": "image",
            "name": name,
            "storage": _storage(),
        },
    )
    assert response.status_code == 201
    return response.json()


def _version(client, asset_id):
    response = client.post(
        f"{PREFIX}/assets/{asset_id}/versions",
        json={"storage": _storage()},
    )
    assert response.status_code == 201
    return response.json()


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["asset_id"], item["version"]),
        reverse=True,
    )


def test_version_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_version_feed_is_newest_first_with_joins_and_fields(client):
    _clear(client)
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")

    a = _asset(client, alpha["id"], "Avatars")  # v1
    a_v2 = _version(client, a["id"])  # v2
    b = _asset(client, beta["id"], "Backdrops")  # v1

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)

    by_key = {(item["asset_id"], item["version"]): item for item in items}
    assert set(by_key) == {
        (a["id"], 1),
        (a["id"], 2),
        (b["id"], 1),
    }

    for item in items:
        assert set(item) == _ITEM_KEYS

    avatars_v1 = by_key[(a["id"], 1)]
    assert avatars_v1["project_id"] == alpha["id"]
    assert avatars_v1["project_name"] == "Alpha Project"
    assert avatars_v1["asset_name"] == "Avatars"
    assert avatars_v1["asset_type"] == "image"
    assert avatars_v1["version"] == 1
    assert avatars_v1["created_by"] == a["creator_id"]
    assert avatars_v1["created_at"]

    assert by_key[(b["id"], 1)]["project_name"] == "Beta Project"
    assert by_key[(b["id"], 1)]["asset_name"] == "Backdrops"
    assert by_key[(a["id"], 2)]["version"] == 2
    assert a_v2["version"] == 2


def test_version_feed_project_scope_narrows_derivation(client):
    _clear(client)
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")
    a = _asset(client, alpha["id"], "Avatars")
    _version(client, a["id"])  # alpha: 2 versions
    _asset(client, beta["id"], "Backdrops")  # beta: 1 version

    scoped = _feed(client, project_id=alpha["id"]).json()
    assert scoped["total"] == 2
    assert {(item["asset_id"], item["version"]) for item in scoped["items"]} == {
        (a["id"], 1),
        (a["id"], 2),
    }
    assert all(item["project_name"] == "Alpha Project" for item in scoped["items"])

    assert _feed(client).json()["total"] == 3
    assert _feed(client, project_id=beta["id"]).json()["total"] == 1


def test_version_feed_unknown_project_uses_shared_404_envelope(client):
    _clear(client)
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_version_feed_limit_bounds_page_but_not_total(client):
    _clear(client)
    p = _project(client)
    a = _asset(client, p["id"], "Many Versions")
    _version(client, a["id"])
    _version(client, a["id"])
    _version(client, a["id"])

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_version_feed_total_agrees_with_version_stats(client):
    _clear(client)
    p1 = _project(client)
    p2 = _project(client)
    a = _asset(client, p1["id"], "A")
    _version(client, a["id"])
    b = _asset(client, p1["id"], "B")
    _asset(client, p2["id"], "C")

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/versions/stats").json()
    # A v1/v2, B v1, C v1 = 4 version records.
    assert feed["total"] == stats["total_versions"] == 4

    scoped = _feed(client, project_id=p1["id"]).json()
    scoped_stats = client.get(
        f"{PREFIX}/versions/stats", params={"project_id": p1["id"]}
    ).json()
    assert scoped["total"] == scoped_stats["total_versions"] == 3
    assert b["id"]


def test_version_feed_excludes_deleted_and_orphan_versions(client):
    _clear(client)
    p = _project(client)
    keep = _asset(client, p["id"], "Keep")
    drop = _asset(client, p["id"], "Drop")
    _version(client, keep["id"])
    _version(client, drop["id"])
    assert _feed(client).json()["total"] == 4

    # Soft-deleting an asset removes all of its versions from the feed.
    deleted = client.delete(f"{PREFIX}/assets/{drop['id']}")
    assert deleted.status_code == 204
    after_delete = _feed(client).json()
    assert after_delete["total"] == 2
    assert {item["asset_id"] for item in after_delete["items"]} == {keep["id"]}

    # A version record for an unknown asset cannot be attributed and is excluded.
    store = client.app.state.store
    orphan = AssetVersion(
        asset_id=uuid4(),
        version=5,
        storage=StorageRef(**_storage()),
        created_at=utcnow(),
        created_by=uuid4(),
    )
    store.put(
        Collections.ASSET_VERSIONS,
        f"{orphan.asset_id}:5",
        orphan.model_dump(mode="json"),
    )
    assert _feed(client).json()["total"] == 2


def test_version_feed_is_derived_live_from_the_store(client):
    _clear(client)
    p = _project(client)
    assert _feed(client).json()["total"] == 0

    asset = _asset(client, p["id"], "Text-to-image output")
    assert _feed(client).json()["total"] == 1

    # Removing the version record from the authoritative store removes it from
    # the feed without any cached state.
    store = client.app.state.store
    store.delete(Collections.ASSET_VERSIONS, f"{asset['id']}:1")
    assert _feed(client).json()["total"] == 0


def test_version_feed_malformed_project_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_version_feed_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
