"""Authoritative asset version statistics endpoint tests (success + failure)."""

from __future__ import annotations

from uuid import uuid4

from app.schemas.asset import AssetVersion, StorageRef
from app.schemas.common import utcnow
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "total_versions",
    "total_assets",
    "revisions",
    "by_version",
    "by_project",
    "newest_version_at",
    "generated_at",
}


def _stats(client, **params):
    return client.get(f"{PREFIX}/versions/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Version Stats Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _storage(key="asset.png"):
    return {"key": key, "size_bytes": 16, "content_type": "image/png"}


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


def _version_docs(client):
    return [
        AssetVersion.model_validate(doc)
        for doc in client.app.state.store.all(Collections.ASSET_VERSIONS)
    ]


def test_version_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_versions"] == 0
    assert body["total_assets"] == 0
    assert body["revisions"] == 0
    assert body["by_version"] == []
    assert body["by_project"] == []
    assert body["newest_version_at"] is None
    assert body["generated_at"]


def test_version_stats_derives_totals_breakdowns_and_recency(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    a = _asset(client, p1, "A")["id"]  # v1
    b = _asset(client, p1, "B")["id"]  # v1
    _version(client, b)  # v2
    _version(client, b)  # v3
    _asset(client, p2, "C")  # v1

    body = _stats(client).json()
    assert body["total_versions"] == 5
    assert body["total_assets"] == 3
    assert body["revisions"] == 2  # B's v2 and v3

    # by_version is ordered by ascending version number.
    assert body["by_version"] == [
        {"version": 1, "count": 3},
        {"version": 2, "count": 1},
        {"version": 3, "count": 1},
    ]

    # by_project is ordered by descending version count then project id:
    # P1 has A v1 + B v1/v2/v3 (4 versions, 2 assets); P2 has C v1.
    assert [entry["project_id"] for entry in body["by_project"]] == [p1, p2]
    assert body["by_project"][0] == {
        "project_id": p1,
        "versions": 4,
        "assets": 2,
    }
    assert body["by_project"][1] == {
        "project_id": p2,
        "versions": 1,
        "assets": 1,
    }

    expected_newest = max(
        doc.model_dump(mode="json")["created_at"] for doc in _version_docs(client)
    )
    assert body["newest_version_at"] == expected_newest

    # `a` is intentionally referenced so seeding intent is explicit.
    assert a


def test_version_stats_project_scope_counts_only_scoped_versions(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    a = _asset(client, p1, "A")["id"]
    _version(client, a)
    _asset(client, p2, "C")

    scoped = _stats(client, project_id=p1).json()
    assert scoped["total_versions"] == 2
    assert scoped["total_assets"] == 1
    assert scoped["revisions"] == 1
    assert scoped["by_version"] == [
        {"version": 1, "count": 1},
        {"version": 2, "count": 1},
    ]
    assert [entry["project_id"] for entry in scoped["by_project"]] == [p1]

    global_body = _stats(client).json()
    assert global_body["total_versions"] == 3
    assert global_body["total_assets"] == 2


def test_version_stats_unknown_and_malformed_project(client):
    _clear(client)

    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _stats(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_version_stats_is_derived_live_and_excludes_deleted_and_orphans(client):
    _clear(client)
    p = _project(client)["id"]
    keep = _asset(client, p, "Keep")["id"]
    drop = _asset(client, p, "Drop")["id"]
    _version(client, keep)
    _version(client, drop)

    before = _stats(client).json()
    assert before["total_versions"] == 4
    assert before["total_assets"] == 2
    assert before["revisions"] == 2

    # Soft-deleting an asset removes all of its versions from the snapshot,
    # keeping totals consistent with by_project and by_version.
    deleted = client.delete(f"{PREFIX}/assets/{drop}")
    assert deleted.status_code == 204
    after_delete = _stats(client).json()
    assert after_delete["total_versions"] == 2
    assert after_delete["total_assets"] == 1
    assert after_delete["revisions"] == 1
    assert after_delete["by_version"] == [
        {"version": 1, "count": 1},
        {"version": 2, "count": 1},
    ]
    assert sum(entry["versions"] for entry in after_delete["by_project"]) == 2

    # A version record for an unknown asset cannot be attributed and is excluded.
    store = client.app.state.store
    orphan = AssetVersion(
        asset_id=uuid4(),
        version=5,
        storage=StorageRef(**_storage()),
        created_at=utcnow(),
        created_by=uuid4(),
    )
    store.put(Collections.ASSET_VERSIONS, f"{orphan.asset_id}:5", orphan.model_dump(mode="json"))
    with_orphan = _stats(client).json()
    assert with_orphan["total_versions"] == 2
    assert sum(entry["versions"] for entry in with_orphan["by_project"]) == 2

    # Removing the last live asset empties every view.
    store.delete(Collections.ASSETS, str(keep))
    after = _stats(client).json()
    assert after["total_versions"] == 0
    assert after["total_assets"] == 0
    assert after["by_version"] == []
    assert after["by_project"] == []
    assert after["newest_version_at"] is None
