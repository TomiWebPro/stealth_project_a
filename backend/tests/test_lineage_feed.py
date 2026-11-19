"""Authoritative asset lineage-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.schemas.asset import AssetRelationship
from app.schemas.common import utcnow
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "id",
    "from_asset_id",
    "to_asset_id",
    "from_asset_name",
    "to_asset_name",
    "project_id",
    "project_name",
    "type",
    "created_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/lineage/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Lineage Feed Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _asset(client, project_id, name, parent_ids=None):
    response = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project_id,
            "type": "image",
            "name": name,
            "storage": {
                "backend": "local",
                "key": f"Output/{name}.png",
                "size_bytes": 16,
                "content_type": "image/png",
            },
            "parent_asset_ids": parent_ids or [],
        },
    )
    assert response.status_code == 201
    return response.json()


def _link(client, from_id, to_id, rel_type="derived_from", *, age_seconds=0):
    """Put a typed relationship directly in the authoritative store."""
    rel = AssetRelationship(
        id=uuid4(),
        from_asset_id=from_id,
        to_asset_id=to_id,
        type=rel_type,
        created_at=utcnow() - timedelta(seconds=age_seconds),
    )
    client.app.state.store.put(
        Collections.ASSET_RELATIONSHIPS,
        str(rel.id),
        rel.model_dump(mode="json"),
    )
    return rel


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["id"]),
        reverse=True,
    )


def test_lineage_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_lineage_feed_is_newest_first_with_joins_and_fields(client):
    _clear(client)
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")

    a = _asset(client, alpha["id"], "Avatar")
    b = _asset(client, alpha["id"], "Backdrop")
    c = _asset(client, beta["id"], "Prop")

    _link(client, a["id"], b["id"], "derived_from", age_seconds=0)  # newest
    _link(client, c["id"], a["id"], "uses_input", age_seconds=5)
    _link(client, b["id"], a["id"], "related_to", age_seconds=10)  # oldest

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)
    for item in items:
        assert set(item) == _ITEM_KEYS

    newest = items[0]
    assert newest["from_asset_id"] == a["id"]
    assert newest["to_asset_id"] == b["id"]
    assert newest["from_asset_name"] == "Avatar"
    assert newest["to_asset_name"] == "Backdrop"
    assert newest["project_id"] == alpha["id"]
    assert newest["project_name"] == "Alpha Project"
    assert newest["type"] == "derived_from"

    beta_link = next(item for item in items if item["type"] == "uses_input")
    assert beta_link["from_asset_id"] == c["id"]
    assert beta_link["from_asset_name"] == "Prop"
    assert beta_link["to_asset_name"] == "Avatar"
    assert beta_link["project_id"] == beta["id"]
    assert beta_link["project_name"] == "Beta Project"


def test_lineage_feed_project_scope_narrows_derivation(client):
    _clear(client)
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")
    a = _asset(client, alpha["id"], "A")
    b = _asset(client, alpha["id"], "B")
    c = _asset(client, beta["id"], "C")

    _link(client, a["id"], b["id"])  # alpha
    _link(client, c["id"], a["id"])  # beta

    scoped = _feed(client, project_id=alpha["id"]).json()
    assert scoped["total"] == 1
    assert scoped["items"][0]["from_asset_id"] == a["id"]
    assert scoped["items"][0]["project_name"] == "Alpha Project"

    assert _feed(client).json()["total"] == 2
    assert _feed(client, project_id=beta["id"]).json()["total"] == 1


def test_lineage_feed_unknown_project_uses_shared_404_envelope(client):
    _clear(client)
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_lineage_feed_limit_bounds_page_but_not_total(client):
    _clear(client)
    p = _project(client)
    a = _asset(client, p["id"], "A")
    b = _asset(client, p["id"], "B")
    for age in (0, 1, 2, 3):
        _link(client, a["id"], b["id"], age_seconds=age)

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_lineage_feed_total_agrees_with_lineage_stats(client):
    _clear(client)
    p1 = _project(client)
    p2 = _project(client)
    a = _asset(client, p1["id"], "A")
    _asset(client, p1["id"], "B", [a["id"]])  # one derived_from link in p1
    d = _asset(client, p2["id"], "D")
    _asset(client, p2["id"], "C", [d["id"]])  # one derived_from link in p2

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/lineage/stats").json()
    assert feed["total"] == stats["total_relationships"] == 2

    scoped = _feed(client, project_id=p1["id"]).json()
    scoped_stats = client.get(
        f"{PREFIX}/lineage/stats", params={"project_id": p1["id"]}
    ).json()
    assert scoped["total"] == scoped_stats["total_relationships"] == 1


def test_lineage_feed_excludes_deleted_and_orphan_sources(client):
    _clear(client)
    p = _project(client)
    keep = _asset(client, p["id"], "Keep")
    drop = _asset(client, p["id"], "Drop")
    target = _asset(client, p["id"], "Target")
    _link(client, keep["id"], target["id"])
    _link(client, drop["id"], target["id"])
    assert _feed(client).json()["total"] == 2

    # Soft-deleting a source asset removes its outgoing links from the feed.
    deleted = client.delete(f"{PREFIX}/assets/{drop['id']}")
    assert deleted.status_code == 204
    after_delete = _feed(client).json()
    assert after_delete["total"] == 1
    assert after_delete["items"][0]["from_asset_id"] == keep["id"]

    # A link from an unknown source cannot be attributed and is excluded.
    _link(client, uuid4(), target["id"])
    assert _feed(client).json()["total"] == 1


def test_lineage_feed_keeps_deleted_target_with_name_fallback(client):
    _clear(client)
    p = _project(client)
    source = _asset(client, p["id"], "Source")
    target = _asset(client, p["id"], "Target")
    _link(client, source["id"], target["id"])
    assert _feed(client).json()["items"][0]["to_asset_name"] == "Target"

    # The link still exists from a live source, so it is kept with a stable
    # display-name fallback when the target is soft-deleted.
    assert client.delete(f"{PREFIX}/assets/{target['id']}").status_code == 204
    body = _feed(client).json()
    assert body["total"] == 1
    assert body["items"][0]["to_asset_id"] == target["id"]
    assert body["items"][0]["to_asset_name"] == "Unknown asset"


def test_lineage_feed_is_derived_live_from_the_store(client):
    _clear(client)
    p = _project(client)
    a = _asset(client, p["id"], "A")
    b = _asset(client, p["id"], "B")
    assert _feed(client).json()["total"] == 0

    rel = _link(client, a["id"], b["id"])
    assert _feed(client).json()["total"] == 1

    # Removing the relationship record from the authoritative store removes it
    # from the feed without any cached state.
    client.app.state.store.delete(Collections.ASSET_RELATIONSHIPS, str(rel.id))
    assert _feed(client).json()["total"] == 0


def test_lineage_feed_malformed_project_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]


def test_lineage_feed_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
