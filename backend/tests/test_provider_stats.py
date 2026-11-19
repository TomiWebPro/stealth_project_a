"""Authoritative provider fleet statistics endpoint tests (success + failure)."""

from __future__ import annotations

from .conftest import PREFIX

_KEYS = {
    "total",
    "by_status",
    "by_location",
    "available",
    "degraded",
    "unavailable",
    "total_capabilities",
    "unique_operations",
    "by_operation",
    "generated_at",
}
_STATUSES = [
    {"status": "available", "count": 0},
    {"status": "unavailable", "count": 0},
    {"status": "degraded", "count": 0},
]
_LOCATIONS = [
    {"location": "local", "count": 0},
    {"location": "studio", "count": 0},
    {"location": "cloud", "count": 0},
]


def _stats(client, **params):
    return client.get(f"{PREFIX}/providers/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _put_provider(client, provider_id, *, location="local", status="available", operations=()):
    from app.schemas.provider import Provider, ProviderCapability
    from app.storage.base import Collections

    provider = Provider(
        id=provider_id,
        name=provider_id,
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


def test_provider_stats_derives_seed_fleet(client):
    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    # The provider repository seeds 5 providers on a fresh store.
    assert body["total"] == 5
    assert body["by_status"] == [
        {"status": "available", "count": 3},
        {"status": "unavailable", "count": 1},
        {"status": "degraded", "count": 1},
    ]
    assert body["by_location"] == [
        {"location": "local", "count": 2},
        {"location": "studio", "count": 1},
        {"location": "cloud", "count": 2},
    ]
    assert body["available"] == 3
    assert body["degraded"] == 1
    assert body["unavailable"] == 1
    assert body["total_capabilities"] == 10
    assert body["unique_operations"] == 7
    assert body["by_operation"] == [
        {"operation_id": "image-to-image", "providers": 2, "available": 2},
        {"operation_id": "lora-train", "providers": 2, "available": 1},
        {"operation_id": "text-to-image", "providers": 2, "available": 2},
        {"operation_id": "image-to-video", "providers": 1, "available": 1},
        {"operation_id": "splat-train", "providers": 1, "available": 1},
        {"operation_id": "text-to-text", "providers": 1, "available": 0},
        {"operation_id": "upscale", "providers": 1, "available": 1},
    ]
    assert body["generated_at"]


def test_provider_stats_empty_store_is_zero_filled(client):
    _clear(client)
    body = _stats(client).json()
    assert body["total"] == 0
    assert body["by_status"] == _STATUSES
    assert body["by_location"] == _LOCATIONS
    assert body["available"] == 0
    assert body["degraded"] == 0
    assert body["unavailable"] == 0
    assert body["total_capabilities"] == 0
    assert body["unique_operations"] == 0
    assert body["by_operation"] == []
    assert body["generated_at"]


def test_provider_stats_location_and_status_filters(client):
    cloud = _stats(client, location="cloud").json()
    assert cloud["total"] == 2
    assert cloud["by_location"] == [
        {"location": "local", "count": 0},
        {"location": "studio", "count": 0},
        {"location": "cloud", "count": 2},
    ]
    assert cloud["by_status"] == [
        {"status": "available", "count": 1},
        {"status": "unavailable", "count": 0},
        {"status": "degraded", "count": 1},
    ]

    unavailable = _stats(client, status="unavailable").json()
    assert unavailable["total"] == 1
    assert unavailable["by_status"] == [
        {"status": "available", "count": 0},
        {"status": "unavailable", "count": 1},
        {"status": "degraded", "count": 0},
    ]

    both = _stats(client, location="local", status="unavailable").json()
    assert both["total"] == 1
    assert both["unique_operations"] == 1
    assert both["by_operation"] == [
        {"operation_id": "text-to-text", "providers": 1, "available": 0}
    ]

    # A well-formed filter combination that matches no provider is a valid
    # zero-filled snapshot (studio has only an available provider).
    none = _stats(client, location="studio", status="unavailable").json()
    assert none["total"] == 0
    assert none["by_status"] == _STATUSES
    assert none["by_operation"] == []


def test_provider_stats_is_derived_live_from_the_store(client):
    from app.schemas.provider import Provider
    from app.storage.base import Collections

    _clear(client)
    assert _stats(client).json()["total"] == 0

    _put_provider(client, "a", location="local", status="available", operations=("x", "y"))
    _put_provider(client, "b", location="cloud", status="degraded", operations=("x",))
    first = _stats(client).json()
    assert first["total"] == 2
    assert first["total_capabilities"] == 3
    assert first["unique_operations"] == 2
    assert first["by_operation"] == [
        {"operation_id": "x", "providers": 2, "available": 1},
        {"operation_id": "y", "providers": 1, "available": 1},
    ]

    # Flipping a provider's status is reflected on the next call without rebuild.
    client.app.state.store.put(
        Collections.PROVIDERS,
        "b",
        Provider(
            id="b", name="b", location="cloud", status="available",
            capabilities=[{"operation_id": "x", "schema_versions": ["1.0.0"]}],
        ).model_dump(mode="json"),
    )
    second = _stats(client).json()
    assert second["available"] == 2
    assert second["degraded"] == 0
    assert second["by_operation"][0]["available"] == 2

    _clear(client)
    assert _stats(client).json()["total"] == 0


def test_provider_stats_rejects_invalid_location(client):
    response = _stats(client, location="moon")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_provider_stats_rejects_invalid_status(client):
    response = _stats(client, status="bogus")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]
