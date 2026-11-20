"""Authoritative single asset-version overview endpoint tests (success + failure)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "asset_id",
    "asset_name",
    "asset_type",
    "project_id",
    "project_name",
    "version",
    "storage",
    "created_by",
    "created_at",
    "is_latest",
    "counts",
    "recent_versions",
    "generated_at",
}
_COUNT_KEYS = {"asset_versions", "revisions"}


def _overview(client, asset_id, version, **params):
    return client.get(
        f"{PREFIX}/assets/{asset_id}/versions/{version}/overview", params=params
    )


def _project(client, name="Version Overview Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _store(client):
    return client.app.state.store


def _register(client, project_id, name):
    response = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project_id,
            "type": "image",
            "name": name,
            "storage": {
                "key": f"{uuid4()}.bin",
                "size_bytes": 100,
                "content_type": "image/png",
            },
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _add_version(client, asset_id, *, size_bytes=128):
    key = f"{uuid4()}.bin"
    response = client.post(
        f"{PREFIX}/assets/{asset_id}/versions",
        json={
            "storage": {
                "key": key,
                "size_bytes": size_bytes,
                "content_type": "image/png",
            }
        },
    )
    assert response.status_code == 201, response.text
    return response.json(), key


def _seed_orphan_asset(client, project_id, name="Orphan"):
    from app.schemas.asset import Asset, StorageRef
    from app.schemas.common import utcnow

    now = utcnow()
    asset = Asset(
        id=uuid4(),
        project_id=project_id,
        type="image",
        name=name,
        creator_id=uuid4(),
        storage=StorageRef(
            key=f"{uuid4()}.bin", size_bytes=100, content_type="image/png"
        ),
        created_at=now,
        updated_at=now,
    )
    _store(client).put("assets", str(asset.id), asset.model_dump(mode="json"))
    from app.schemas.asset import AssetVersion

    version = AssetVersion(
        asset_id=asset.id,
        version=1,
        storage=asset.storage,
        created_at=now,
        created_by=asset.creator_id,
    )
    _store(client).put("asset_versions", f"{asset.id}:1", version.model_dump(mode="json"))
    return asset


def test_overview_of_current_version(client):
    project = _project(client, "Current")
    asset = _register(client, project["id"], "Current asset")

    response = _overview(client, asset["id"], 1)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["asset_id"] == asset["id"]
    assert body["asset_name"] == "Current asset"
    assert body["asset_type"] == "image"
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Current"
    assert body["version"] == 1
    assert body["is_latest"] is True
    assert body["storage"] == asset["storage"]
    assert body["created_by"] == asset["creator_id"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {"asset_versions": 1, "revisions": 0}
    assert [item["version"] for item in body["recent_versions"]] == [1]
    assert body["generated_at"]


def test_overview_of_older_version_reports_latest_flag_and_its_storage(client):
    project = _project(client, "History")
    asset = _register(client, project["id"], "Versioned")
    _, v2_key = _add_version(client, asset["id"])
    _add_version(client, asset["id"])  # v3 is now current

    full = _overview(client, asset["id"], 3).json()
    assert full["version"] == 3
    assert full["is_latest"] is True

    older = _overview(client, asset["id"], 2).json()
    assert older["version"] == 2
    assert older["is_latest"] is False
    assert older["storage"]["key"] == v2_key
    assert [item["version"] for item in older["recent_versions"]] == [3, 2, 1]


def test_counts_revisions_and_never_bounded_by_recent_limit(client):
    project = _project(client, "Counts")
    asset = _register(client, project["id"], "Many revisions")
    _add_version(client, asset["id"])  # v2
    _add_version(client, asset["id"])  # v3

    full = _overview(client, asset["id"], 1).json()
    assert full["counts"] == {"asset_versions": 3, "revisions": 2}

    bounded = _overview(client, asset["id"], 1, recent_limit=2).json()
    assert bounded["counts"] == {"asset_versions": 3, "revisions": 2}
    assert [item["version"] for item in bounded["recent_versions"]] == [3, 2]


def test_orphan_project_uses_unknown_fallback(client):
    project = _project(client, "Joined")
    asset = _register(client, project["id"], "In project")
    assert _overview(client, asset["id"], 1).json()["project_name"] == "Joined"

    orphan = _seed_orphan_asset(client, uuid4())
    view = _overview(client, orphan.id, 1).json()
    assert view["project_name"] == "Unknown project"


def test_soft_deleted_asset_still_returns_version_overview(client):
    project = _project(client, "Deleted")
    asset = _register(client, project["id"], "Gone")
    assert client.delete(f"{PREFIX}/assets/{asset['id']}").status_code == 204
    response = _overview(client, asset["id"], 1)
    assert response.status_code == 200
    assert response.json()["asset_name"] == "Gone"


def test_unknown_asset_uses_shared_404_envelope(client):
    response = _overview(client, uuid4(), 1)
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "asset_not_found"
    assert error["request_id"]


def test_unknown_version_uses_shared_404_envelope(client):
    project = _project(client, "Missing version")
    asset = _register(client, project["id"], "Only v1")
    response = _overview(client, asset["id"], 9)
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "version_not_found"
    assert error["request_id"]


def test_malformed_asset_id_uses_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/assets/not-a-uuid/versions/1/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_malformed_version_uses_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/assets/{uuid4()}/versions/not-a-number/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_non_positive_version_uses_shared_422_envelope(client):
    project = _project(client, "Bounds")
    asset = _register(client, project["id"], "Bounded")
    response = _overview(client, asset["id"], 0)
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    project = _project(client, "Limits")
    asset = _register(client, project["id"], "Limited")
    for limit in (0, 51):
        response = _overview(client, asset["id"], 1, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
