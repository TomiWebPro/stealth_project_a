"""Authoritative asset lineage statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_TYPES = ["derived_from", "variant_of", "uses_input", "related_to", "duplicate_of"]
_KEYS = {
    "total_relationships",
    "total_linked_assets",
    "by_type",
    "by_project",
    "newest_relationship_at",
    "generated_at",
}


def _stats(client, **params):
    return client.get(f"{PREFIX}/lineage/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Lineage Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_asset(client, project_id, *, status="ready", created_at=None):
    """Write an Asset straight to the authoritative store."""
    from app.schemas.asset import Asset, StorageRef
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    asset = Asset(
        id=uuid4(),
        project_id=project_id,
        type="image",
        name="Seeded asset",
        status=status,
        creator_id=uuid4(),
        storage=StorageRef(
            key=f"{uuid4()}.bin",
            size_bytes=100,
            content_type="application/octet-stream",
        ),
        created_at=created_at or now,
        updated_at=now,
    )
    client.app.state.store.put(
        Collections.ASSETS, str(asset.id), asset.model_dump(mode="json")
    )
    return asset


def _seed_relationship(client, from_asset_id, to_asset_id, rel_type, *, created_at=None):
    """Write an AssetRelationship straight to the authoritative store."""
    from app.schemas.asset import AssetRelationship
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    relationship = AssetRelationship(
        id=uuid4(),
        from_asset_id=from_asset_id,
        to_asset_id=to_asset_id,
        type=rel_type,
        created_at=created_at or utcnow(),
    )
    client.app.state.store.put(
        Collections.ASSET_RELATIONSHIPS,
        str(relationship.id),
        relationship.model_dump(mode="json"),
    )
    return relationship


def test_lineage_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_relationships"] == 0
    assert body["total_linked_assets"] == 0
    assert body["by_type"] == [{"type": t, "count": 0} for t in _TYPES]
    assert body["by_project"] == []
    assert body["newest_relationship_at"] is None
    assert body["generated_at"]


def test_lineage_stats_derives_totals_breakdowns_and_recency(client):
    from app.schemas.common import utcnow

    _clear(client)
    now = utcnow()
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    a1, a2, a3 = (_seed_asset(client, p1) for _ in range(3))
    b1, b2 = (_seed_asset(client, p2) for _ in range(2))

    old = _seed_relationship(client, a1.id, a2.id, "derived_from", created_at=now - timedelta(hours=3))
    _seed_relationship(client, a1.id, a3.id, "derived_from", created_at=now - timedelta(hours=2))
    _seed_relationship(client, a2.id, a3.id, "variant_of", created_at=now - timedelta(hours=1))
    newest = _seed_relationship(client, b1.id, b2.id, "uses_input", created_at=now)

    body = _stats(client).json()
    assert body["total_relationships"] == 4
    # Live assets involved: a1, a2, a3, b1, b2 (all five).
    assert body["total_linked_assets"] == 5
    assert body["by_type"] == [
        {"type": "derived_from", "count": 2},
        {"type": "variant_of", "count": 1},
        {"type": "uses_input", "count": 1},
        {"type": "related_to", "count": 0},
        {"type": "duplicate_of", "count": 0},
    ]
    # p1 (3 links) before p2 (1 link).
    assert body["by_project"] == [
        {"project_id": p1, "relationships": 3},
        {"project_id": p2, "relationships": 1},
    ]
    assert body["newest_relationship_at"] == newest.created_at.isoformat().replace("+00:00", "Z")
    assert old.created_at < newest.created_at


def test_lineage_stats_project_scope_unknown_and_malformed(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]
    a1, a2 = (_seed_asset(client, p1) for _ in range(2))
    b1, b2 = (_seed_asset(client, p2) for _ in range(2))
    _seed_relationship(client, a1.id, a2.id, "derived_from")
    _seed_relationship(client, b1.id, b2.id, "related_to")

    scoped = _stats(client, project_id=p1)
    assert scoped.status_code == 200
    body = scoped.json()
    assert body["total_relationships"] == 1
    assert body["total_linked_assets"] == 2
    assert body["by_type"] == [
        {"type": "derived_from", "count": 1},
        {"type": "variant_of", "count": 0},
        {"type": "uses_input", "count": 0},
        {"type": "related_to", "count": 0},
        {"type": "duplicate_of", "count": 0},
    ]
    assert body["by_project"] == [{"project_id": p1, "relationships": 1}]

    # Unknown-but-well-formed project uses the shared 404 envelope.
    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _stats(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_lineage_stats_excludes_deleted_sources_and_targets(client):
    _clear(client)
    p = _project(client)["id"]
    live_a = _seed_asset(client, p)
    live_b = _seed_asset(client, p)
    deleted = _seed_asset(client, p, status="deleted")

    _seed_relationship(client, live_a.id, live_b.id, "derived_from")
    # A link from a deleted source is excluded entirely.
    _seed_relationship(client, deleted.id, live_a.id, "variant_of")
    # A link to a deleted target still counts as a relationship but the deleted
    # target is not counted as a linked asset.
    _seed_relationship(client, live_b.id, deleted.id, "related_to")

    body = _stats(client).json()
    assert body["total_relationships"] == 2
    assert body["total_linked_assets"] == 2  # live_a + live_b only
    assert body["by_type"] == [
        {"type": "derived_from", "count": 1},
        {"type": "variant_of", "count": 0},
        {"type": "uses_input", "count": 0},
        {"type": "related_to", "count": 1},
        {"type": "duplicate_of", "count": 0},
    ]


def test_lineage_stats_by_project_tie_break_is_deterministic(client):
    _clear(client)
    low, high = uuid4(), uuid4()
    if low > high:
        low, high = high, low
    # Seed projects directly with fixed ids so both have exactly one link.
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    for project_id in (low, high):
        client.app.state.store.put(
            Collections.PROJECTS,
            str(project_id),
            Project(
                id=project_id,
                org_id=uuid4(),
                name="P",
                created_by=uuid4(),
                created_at=now,
                updated_at=now,
            ).model_dump(mode="json"),
        )
    for project_id in (high, low):
        a, b = (_seed_asset(client, project_id) for _ in range(2))
        _seed_relationship(client, a.id, b.id, "derived_from")

    body = _stats(client).json()
    assert body["by_project"] == [
        {"project_id": str(low), "relationships": 1},
        {"project_id": str(high), "relationships": 1},
    ]


def test_lineage_stats_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    _clear(client)
    p = _project(client)["id"]
    a, b = (_seed_asset(client, p) for _ in range(2))
    assert _stats(client).json()["total_relationships"] == 0

    relationship = _seed_relationship(client, a.id, b.id, "derived_from")
    first = _stats(client).json()
    assert first["total_relationships"] == 1
    assert first["by_type"][0] == {"type": "derived_from", "count": 1}

    client.app.state.store.delete(Collections.ASSET_RELATIONSHIPS, str(relationship.id))
    second = _stats(client).json()
    assert second["total_relationships"] == 0
    assert second["total_linked_assets"] == 0
    assert second["by_type"] == [{"type": t, "count": 0} for t in _TYPES]
    assert second["newest_relationship_at"] is None
