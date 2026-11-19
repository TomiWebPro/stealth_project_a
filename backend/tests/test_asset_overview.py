"""Authoritative asset-overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "asset_id",
    "asset_name",
    "asset_type",
    "status",
    "version",
    "project_id",
    "project_name",
    "created_at",
    "published",
    "counts",
    "recent_versions",
    "generated_at",
}
_COUNT_KEYS = {"versions", "upstream", "downstream", "comments", "tags"}


def _overview(client, asset_id, **params):
    return client.get(f"{PREFIX}/assets/{asset_id}/overview", params=params)


def _project(client, name="Overview Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _store(client):
    return client.app.state.store


def _register(client, project_id, name, *, parent_ids=None, tags=None, receipt=None):
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
            "parent_asset_ids": parent_ids or [],
            "tags": tags or [],
        },
    )
    assert response.status_code == 201, response.text
    if receipt is not None:
        asset = response.json()
        doc = _store(client).get("assets", asset["id"])
        doc["metadata"] = {"publish_receipt": receipt}
        _store(client).put("assets", asset["id"], doc)
    return response.json()


def _add_version(client, asset_id):
    response = client.post(
        f"{PREFIX}/assets/{asset_id}/versions",
        json={
            "storage": {
                "key": f"{uuid4()}.bin",
                "size_bytes": 128,
                "content_type": "image/png",
            }
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _seed_comment(client, project_id, asset_id):
    from app.schemas.common import utcnow
    from app.schemas.orchestration import Comment

    record = Comment(
        id=uuid4(),
        project_id=project_id,
        asset_id=asset_id,
        author_id=uuid4(),
        body="A comment",
        created_at=utcnow(),
    )
    _store(client).put("comments", str(record.id), record.model_dump(mode="json"))


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
            key=f"{uuid4()}.bin",
            size_bytes=100,
            content_type="image/png",
        ),
        created_at=now,
        updated_at=now,
    )
    _store(client).put("assets", str(asset.id), asset.model_dump(mode="json"))
    return asset


def test_overview_of_fresh_asset(client):
    project = _project(client, "Fresh")
    asset = _register(client, project["id"], "Fresh asset", tags=["alpha", "beta"])

    response = _overview(client, asset["id"])
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["asset_id"] == asset["id"]
    assert body["asset_name"] == "Fresh asset"
    assert body["asset_type"] == "image"
    assert body["status"] == "ready"
    assert body["version"] == 1
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Fresh"
    assert body["created_at"] == asset["created_at"]
    assert body["published"] is False
    assert set(body["counts"]) == _COUNT_KEYS
    # Registration records version 1; no lineage/comments yet.
    assert body["counts"] == {
        "versions": 1,
        "upstream": 0,
        "downstream": 0,
        "comments": 0,
        "tags": 2,
    }
    assert len(body["recent_versions"]) == 1
    assert body["generated_at"]


def test_overview_counts_versions_and_bounds_recent(client):
    project = _project(client, "Versions")
    asset = _register(client, project["id"], "Versioned")
    _add_version(client, asset["id"])  # v2
    _add_version(client, asset["id"])  # v3

    full = _overview(client, asset["id"]).json()
    assert full["version"] == 3
    assert full["counts"]["versions"] == 3
    assert [item["version"] for item in full["recent_versions"]] == [3, 2, 1]

    bounded = _overview(client, asset["id"], recent_limit=2).json()
    assert bounded["counts"]["versions"] == 3  # count not bounded by the page
    assert [item["version"] for item in bounded["recent_versions"]] == [3, 2]


def test_overview_counts_upstream_and_downstream(client):
    project = _project(client, "Lineage")
    parent = _register(client, project["id"], "Parent")
    child = _register(client, project["id"], "Child", parent_ids=[parent["id"]])

    child_view = _overview(client, child["id"]).json()
    assert child_view["counts"]["upstream"] == 1
    assert child_view["counts"]["downstream"] == 0

    parent_view = _overview(client, parent["id"]).json()
    assert parent_view["counts"]["upstream"] == 0
    assert parent_view["counts"]["downstream"] == 1

    # A soft-deleted child is excluded from the parent's downstream count.
    response = client.delete(f"{PREFIX}/assets/{child['id']}")
    assert response.status_code == 204
    parent_view = _overview(client, parent["id"]).json()
    assert parent_view["counts"]["downstream"] == 0


def test_overview_ignores_non_lineage_relationships(client):
    from app.schemas.asset import AssetRelationship
    from app.schemas.common import utcnow

    project = _project(client, "Related")
    a = _register(client, project["id"], "A")
    b = _register(client, project["id"], "B")
    relationship = AssetRelationship(
        id=uuid4(),
        from_asset_id=a["id"],
        to_asset_id=b["id"],
        type="related_to",
        created_at=utcnow(),
    )
    _store(client).put(
        "asset_relationships", str(relationship.id), relationship.model_dump(mode="json")
    )

    view = _overview(client, a["id"]).json()
    assert view["counts"]["upstream"] == 0
    assert view["counts"]["downstream"] == 0


def test_overview_counts_comments(client):
    project = _project(client, "Comments")
    asset = _register(client, project["id"], "Discussed")
    other = _register(client, project["id"], "Other")
    for _ in range(3):
        _seed_comment(client, project["id"], asset["id"])
    _seed_comment(client, project["id"], other["id"])

    view = _overview(client, asset["id"]).json()
    assert view["counts"]["comments"] == 3


def test_overview_published_flag_uses_receipt_parser(client):
    project = _project(client, "Published")
    good = _register(
        client,
        project["id"],
        "Good",
        receipt={
            "version": 1,
            "size_bytes": 100,
            "published_at": "2026-01-01T00:00:00Z",
        },
    )
    bad = _register(client, project["id"], "Bad", receipt={"version": "bad"})

    assert _overview(client, good["id"]).json()["published"] is True
    assert _overview(client, bad["id"]).json()["published"] is False


def test_overview_joins_project_name_with_orphan_fallback(client):
    project = _project(client, "Joined")
    asset = _register(client, project["id"], "In project")
    assert _overview(client, asset["id"]).json()["project_name"] == "Joined"

    orphan = _seed_orphan_asset(client, uuid4())
    assert _overview(client, orphan.id).json()["project_name"] == "Unknown project"


def test_overview_includes_soft_deleted_asset_status(client):
    project = _project(client, "Deleted")
    asset = _register(client, project["id"], "Gone")
    assert client.delete(f"{PREFIX}/assets/{asset['id']}").status_code == 204
    view = _overview(client, asset["id"]).json()
    assert view["status"] == "deleted"


def test_unknown_asset_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "asset_not_found"
    assert error["request_id"]


def test_malformed_asset_id_uses_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/assets/not-a-uuid/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    project = _project(client, "Limits")
    asset = _register(client, project["id"], "Limited")
    for limit in (0, 51):
        response = _overview(client, asset["id"], recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
