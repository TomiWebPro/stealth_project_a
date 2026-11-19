"""Authoritative asset-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "asset_id",
    "project_id",
    "project_name",
    "type",
    "name",
    "status",
    "version",
    "size_bytes",
    "created_at",
    "updated_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/assets/feed", params=params)


def _project(client, name="Feed Project"):
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


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["asset_id"]),
        reverse=True,
    )


def test_asset_feed_empty_store_is_zero_filled(client):
    client.app.state.store.clear()

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_asset_feed_is_newest_first_with_project_identity_and_asset_fields(client):
    from app.schemas.common import utcnow

    client.app.state.store.clear()
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]
    now = utcnow()

    a1 = _seed_asset(
        client,
        p1,
        type="video",
        status="ready",
        name="Hero shot",
        size_bytes=250,
        version=3,
        created_at=now - timedelta(hours=2),
    )
    a2 = _seed_asset(
        client,
        p1,
        type="image",
        status="processing",
        name="Frame",
        size_bytes=100,
        created_at=now,
    )
    a3 = _seed_asset(
        client,
        p2,
        type="lora",
        name="Character LoRA",
        size_bytes=75,
        version=2,
        created_at=now - timedelta(hours=1),
    )

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)  # deterministic (created_at, asset_id) order
    assert [item["asset_id"] for item in items] == [str(a2.id), str(a3.id), str(a1.id)]

    by_id = {item["asset_id"]: item for item in items}
    assert set(by_id) == {str(a1.id), str(a2.id), str(a3.id)}
    assert set(by_id[str(a1.id)]) == _ITEM_KEYS

    hero = by_id[str(a1.id)]
    assert hero["project_id"] == p1
    assert hero["project_name"] == "Alpha"
    assert hero["type"] == "video"
    assert hero["name"] == "Hero shot"
    assert hero["status"] == "ready"
    assert hero["version"] == 3
    assert hero["size_bytes"] == 250
    assert hero["created_at"] and hero["updated_at"]

    assert by_id[str(a2.id)]["project_name"] == "Alpha"
    assert by_id[str(a2.id)]["type"] == "image"
    assert by_id[str(a2.id)]["status"] == "processing"
    lora = by_id[str(a3.id)]
    assert lora["project_name"] == "Beta"
    assert lora["type"] == "lora"
    assert lora["version"] == 2


def test_asset_feed_excludes_soft_deleted_assets(client):
    from app.schemas.common import utcnow

    client.app.state.store.clear()
    project_id = _project(client)["id"]
    now = utcnow()
    live = _seed_asset(client, project_id, name="Live", created_at=now)
    _seed_asset(
        client,
        project_id,
        name="Deleted",
        status="deleted",
        size_bytes=999,
        version=9,
        created_at=now + timedelta(hours=1),
    )

    body = _feed(client).json()
    assert body["total"] == 1
    assert [item["asset_id"] for item in body["items"]] == [str(live.id)]


def test_asset_feed_project_scope_narrows_derivation(client):
    client.app.state.store.clear()
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]
    a1 = _seed_asset(client, p1, name="Alpha asset")
    _seed_asset(client, p2, name="Beta asset")

    scoped = _feed(client, project_id=p1).json()
    assert scoped["total"] == 1
    assert [item["asset_id"] for item in scoped["items"]] == [str(a1.id)]
    assert scoped["items"][0]["project_name"] == "Alpha"

    assert _feed(client).json()["total"] == 2
    assert _feed(client, project_id=p2).json()["total"] == 1


def test_asset_feed_limit_bounds_page_but_not_total(client):
    client.app.state.store.clear()
    project_id = _project(client)["id"]
    for index in range(4):
        _seed_asset(client, project_id, name=f"Asset {index}")

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_asset_feed_total_agrees_with_asset_stats(client):
    client.app.state.store.clear()
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]
    _seed_asset(client, p1, type="video")
    _seed_asset(client, p1, type="image", status="processing")
    _seed_asset(client, p2, type="lora", status="failed")
    _seed_asset(client, p2, type="resource", status="deleted")

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/assets/stats").json()
    assert feed["total"] == stats["total"] == 3
    assert sum(item["size_bytes"] for item in feed["items"]) == stats["total_size_bytes"]


def test_asset_feed_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    client.app.state.store.clear()
    project_id = _project(client)["id"]
    assert _feed(client).json()["total"] == 0

    seeded = _seed_asset(client, project_id, name="Live", size_bytes=100, version=2)
    second = _feed(client).json()
    assert second["total"] == 1
    assert second["items"][0]["asset_id"] == str(seeded.id)
    assert second["items"][0]["size_bytes"] == 100
    assert second["items"][0]["version"] == 2

    # Flipping an asset to deleted removes it from the feed without any rebuild.
    client.app.state.store.put(
        Collections.ASSETS,
        str(seeded.id),
        {**seeded.model_dump(mode="json"), "status": "deleted"},
    )
    assert _feed(client).json()["total"] == 0


def test_asset_feed_unknown_project_uses_shared_404_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_asset_feed_malformed_project_id_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_asset_feed_invalid_limit_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
