"""Authoritative asset inventory statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_TYPES = [
    "image",
    "video",
    "audio",
    "model3d",
    "splat",
    "texture",
    "dataset",
    "lora",
    "scene",
    "resource",
]
_STATUSES = ["pending", "processing", "ready", "failed", "deleted"]
_KEYS = {
    "total",
    "by_type",
    "by_status",
    "total_size_bytes",
    "total_versions",
    "newest_asset_at",
    "generated_at",
}


def _project(client, name="Stats Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_asset(
    client,
    project_id,
    *,
    type="image",
    status="ready",
    name="Seeded asset",
    size_bytes=100,
    version=1,
    created_at=None,
):
    """Write an Asset straight to the authoritative store."""
    from app.schemas.asset import Asset, StorageRef
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    asset = Asset(
        id=uuid4(),
        project_id=project_id,
        type=type,
        name=name,
        status=status,
        creator_id=uuid4(),
        version=version,
        storage=StorageRef(
            key=f"{uuid4()}.bin",
            size_bytes=size_bytes,
            content_type="application/octet-stream",
        ),
        created_at=created_at or now,
        updated_at=now,
    )
    client.app.state.store.put(
        Collections.ASSETS,
        str(asset.id),
        asset.model_dump(mode="json"),
    )
    return asset


def _stats(client, **params):
    return client.get(f"{PREFIX}/assets/stats", params=params)


def test_asset_stats_empty_store_is_zero_filled(client):
    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["by_type"] == [{"type": t, "count": 0} for t in _TYPES]
    assert body["by_status"] == [{"status": s, "count": 0} for s in _STATUSES]
    assert body["total_size_bytes"] == 0
    assert body["total_versions"] == 0
    assert body["newest_asset_at"] is None
    assert body["generated_at"]


def test_asset_stats_derives_counts_breakdowns_size_versions_and_recency(client):
    from app.schemas.common import utcnow

    p1 = _project(client, "Scoped One")["id"]
    p2 = _project(client, "Scoped Two")["id"]
    now = utcnow()

    newest = _seed_asset(client, p1, type="video", size_bytes=250, version=3, created_at=now)
    _seed_asset(client, p1, type="image", size_bytes=100, created_at=now - timedelta(hours=3))
    _seed_asset(
        client,
        p1,
        type="image",
        status="processing",
        size_bytes=50,
        created_at=now - timedelta(hours=2),
    )
    _seed_asset(
        client,
        p1,
        type="lora",
        status="failed",
        size_bytes=75,
        version=2,
        created_at=now - timedelta(hours=1),
    )
    # A deleted asset (even with the newest timestamp) is excluded everywhere.
    _seed_asset(
        client,
        p1,
        type="resource",
        status="deleted",
        size_bytes=999,
        version=9,
        created_at=now + timedelta(hours=1),
    )
    _seed_asset(client, p2, type="texture", size_bytes=40, created_at=now - timedelta(hours=4))

    body = _stats(client).json()
    assert body["total"] == 5
    assert body["by_type"] == [
        {"type": "image", "count": 2},
        {"type": "video", "count": 1},
        {"type": "audio", "count": 0},
        {"type": "model3d", "count": 0},
        {"type": "splat", "count": 0},
        {"type": "texture", "count": 1},
        {"type": "dataset", "count": 0},
        {"type": "lora", "count": 1},
        {"type": "scene", "count": 0},
        {"type": "resource", "count": 0},
    ]
    assert body["by_status"] == [
        {"status": "pending", "count": 0},
        {"status": "processing", "count": 1},
        {"status": "ready", "count": 3},
        {"status": "failed", "count": 1},
        {"status": "deleted", "count": 0},
    ]
    assert body["total_size_bytes"] == 515
    assert body["total_versions"] == 8
    assert body["newest_asset_at"] == newest.created_at.isoformat().replace("+00:00", "Z")


def test_asset_stats_project_scope_and_unknown_project_404(client):
    p1 = _project(client, "Scoped One")["id"]
    p2 = _project(client, "Scoped Two")["id"]
    _seed_asset(client, p1, type="video", size_bytes=250, version=3)
    _seed_asset(client, p1, type="image", status="failed", size_bytes=75, version=2)
    _seed_asset(client, p2, type="audio", size_bytes=40)

    scoped = _stats(client, project_id=p1)
    assert scoped.status_code == 200
    scoped_body = scoped.json()
    assert scoped_body["total"] == 2
    assert scoped_body["total_size_bytes"] == 325
    assert scoped_body["total_versions"] == 5
    assert scoped_body["by_type"][0] == {"type": "image", "count": 1}
    assert scoped_body["by_type"][1] == {"type": "video", "count": 1}
    assert scoped_body["by_type"][2] == {"type": "audio", "count": 0}
    assert scoped_body["by_status"][1] == {"status": "processing", "count": 0}
    assert scoped_body["by_status"][3] == {"status": "failed", "count": 1}

    all_body = _stats(client).json()
    assert all_body["total"] == 3
    assert all_body["by_type"][2] == {"type": "audio", "count": 1}

    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    error = missing.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == missing.headers["X-Request-ID"]


def test_asset_stats_excludes_deleted_assets_from_every_metric(client):
    project = _project(client)["id"]
    _seed_asset(client, project, type="image", size_bytes=100, version=1)
    _seed_asset(
        client,
        project,
        type="image",
        status="deleted",
        size_bytes=900,
        version=7,
    )

    body = _stats(client).json()
    assert body["total"] == 1
    assert body["by_type"][0] == {"type": "image", "count": 1}
    assert body["by_status"][0] == {"status": "pending", "count": 0}  # shape sanity
    assert body["by_status"][4] == {"status": "deleted", "count": 0}
    assert body["total_size_bytes"] == 100
    assert body["total_versions"] == 1


def test_asset_stats_rejects_malformed_project_id(client):
    response = _stats(client, project_id="not-a-uuid")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_asset_stats_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    project = _project(client)["id"]
    first = _stats(client).json()
    assert first["total"] == 0

    seeded = _seed_asset(client, project, type="image", size_bytes=100, version=2)
    second = _stats(client).json()
    assert second["total"] == 1
    assert second["by_type"][0] == {"type": "image", "count": 1}
    assert second["total_size_bytes"] == 100
    assert second["total_versions"] == 2
    assert second["newest_asset_at"] == seeded.created_at.isoformat().replace("+00:00", "Z")

    client.app.state.store.clear()
    third = _stats(client).json()
    assert third["total"] == 0
    assert third["newest_asset_at"] is None

    # Derivation reflects status changes live: flipping an asset to deleted
    # removes it from the snapshot without any rebuild.
    live = _seed_asset(client, project, type="image", size_bytes=100)
    assert _stats(client).json()["total"] == 1
    client.app.state.store.put(
        Collections.ASSETS,
        str(live.id),
        {**live.model_dump(mode="json"), "status": "deleted"},
    )
    fourth = _stats(client).json()
    assert fourth["total"] == 0
    assert fourth["total_size_bytes"] == 0
    assert fourth["by_status"][4] == {"status": "deleted", "count": 0}
