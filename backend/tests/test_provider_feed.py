"""Authoritative provider-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from app.schemas.provider import Provider, ProviderCapability
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "provider_id",
    "name",
    "location",
    "status",
    "operation_ids",
    "capability_count",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/providers/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _seed_provider(client, *, name="Provider", provider_id=None, location="local", status="available", operations=()):
    provider = Provider(
        id=provider_id or f"provider-{name}",
        name=name,
        location=location,
        status=status,
        capabilities=[
            ProviderCapability(operation_id=operation, schema_versions=["1.0.0"])
            for operation in operations
        ],
    )
    client.app.state.store.put(
        Collections.PROVIDERS, provider.id, provider.model_dump(mode="json")
    )
    return provider


def test_provider_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_provider_feed_is_deterministic_and_projects_capabilities(client):
    _clear(client)
    _seed_provider(client, name="Zulu", provider_id="z-1", operations=("image-to-video", "text-to-image"))
    _seed_provider(client, name="Alpha", provider_id="a-2", location="cloud", status="degraded", operations=("lora-train",))

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 2
    items = body["items"]
    assert len(items) == 2
    for item in items:
        assert set(item) == _ITEM_KEYS

    # Deterministic ascending (name, provider_id) order.
    assert [item["provider_id"] for item in items] == ["a-2", "z-1"]

    alpha = items[0]
    assert alpha["name"] == "Alpha"
    assert alpha["location"] == "cloud"
    assert alpha["status"] == "degraded"
    assert alpha["operation_ids"] == ["lora-train"]
    assert alpha["capability_count"] == 1

    zulu = items[1]
    assert zulu["location"] == "local"
    assert zulu["status"] == "available"
    # operation ids are sorted and deduplicated.
    assert zulu["operation_ids"] == ["image-to-video", "text-to-image"]
    assert zulu["capability_count"] == 2


def test_provider_feed_tie_break_by_provider_id(client):
    _clear(client)
    _seed_provider(client, name="Same", provider_id="b")
    _seed_provider(client, name="Same", provider_id="a")

    items = _feed(client).json()["items"]
    assert [item["provider_id"] for item in items] == ["a", "b"]


def test_provider_feed_deduplicates_operation_ids_but_counts_capabilities(client):
    _clear(client)
    provider = Provider(
        id="dup",
        name="Dup",
        location="local",
        status="available",
        capabilities=[
            ProviderCapability(operation_id="upscale", schema_versions=["1.0.0"]),
            ProviderCapability(operation_id="upscale", schema_versions=["2.0.0"]),
        ],
    )
    client.app.state.store.put(
        Collections.PROVIDERS, provider.id, provider.model_dump(mode="json")
    )

    item = _feed(client).json()["items"][0]
    assert item["operation_ids"] == ["upscale"]
    assert item["capability_count"] == 2


def test_provider_feed_filters_narrow_items_and_total(client):
    _clear(client)
    _seed_provider(client, name="A", provider_id="a", location="local", status="available")
    _seed_provider(client, name="B", provider_id="b", location="cloud", status="available")
    _seed_provider(client, name="C", provider_id="c", location="local", status="unavailable")

    by_location = _feed(client, location="local").json()
    assert by_location["total"] == 2
    assert {item["provider_id"] for item in by_location["items"]} == {"a", "c"}

    by_status = _feed(client, status="available").json()
    assert by_status["total"] == 2
    assert {item["provider_id"] for item in by_status["items"]} == {"a", "b"}

    both = _feed(client, location="local", status="available").json()
    assert both["total"] == 1
    assert both["items"][0]["provider_id"] == "a"


def test_provider_feed_limit_bounds_page_but_not_total(client):
    _clear(client)
    for i in range(4):
        _seed_provider(client, name=f"P{i}", provider_id=f"p-{i}")

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2


def test_provider_feed_total_agrees_with_provider_stats(client):
    _clear(client)
    _seed_provider(client, name="A", provider_id="a", location="local", status="available")
    _seed_provider(client, name="B", provider_id="b", location="cloud", status="degraded")
    _seed_provider(client, name="C", provider_id="c", location="cloud", status="available")

    for params in ({}, {"location": "cloud"}, {"status": "available"}, {"location": "local", "status": "degraded"}):
        feed = _feed(client, **params).json()
        stats = client.get(f"{PREFIX}/providers/stats", params=params).json()
        assert feed["total"] == stats["total"]


def test_provider_feed_is_derived_live_from_the_store(client):
    _clear(client)
    assert _feed(client).json()["total"] == 0

    provider = _seed_provider(client, name="Live", provider_id="live", operations=("upscale",))
    item = _feed(client).json()["items"][0]
    assert item["capability_count"] == 1

    client.app.state.store.delete(Collections.PROVIDERS, provider.id)
    assert _feed(client).json()["total"] == 0


def test_provider_feed_literal_route_wins_over_provider_id(client):
    _seed_provider(client, name="Feed", provider_id="feed")

    assert _feed(client).status_code == 200
    detail = client.get(f"{PREFIX}/providers/feed")
    assert detail.json()["total"] >= 1
    # The templated detail route still resolves a regular provider id.
    other = _seed_provider(client, name="Detail", provider_id="detail")
    assert client.get(f"{PREFIX}/providers/{other.id}").json()["id"] == "detail"


def test_provider_feed_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert error["request_id"] == response.headers["X-Request-ID"]


def test_provider_feed_invalid_filters_use_shared_422_envelope(client):
    _clear(client)
    for bad_filter in ({"location": "moon"}, {"status": "sleeping"}):
        response = _feed(client, **bad_filter)
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert error["request_id"] == response.headers["X-Request-ID"]
