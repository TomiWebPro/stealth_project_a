"""Authoritative provider-overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "provider_id",
    "name",
    "location",
    "status",
    "metadata",
    "operation_ids",
    "catalog_operations",
    "counts",
    "generated_at",
}
_COUNT_KEYS = {
    "capabilities",
    "advertised_operations",
    "catalog_operations",
    "schema_versions",
}
_OPERATION_KEYS = {
    "operation_id",
    "title",
    "catalog_version",
    "advertised_versions",
    "schema_match",
}


def _overview(client, provider_id):
    return client.get(f"{PREFIX}/providers/{provider_id}/overview")


def _store(client):
    return client.app.state.store


def _seed_provider(client, provider_id, **overrides):
    """Write a Provider straight to the authoritative store with deterministic data."""
    from app.schemas.provider import Provider, ProviderCapability
    from app.storage.base import Collections

    values = dict(
        id=provider_id,
        name="Overview Provider",
        location="local",
        status="available",
        capabilities=[
            ProviderCapability(operation_id="text-to-image", schema_versions=["1.0.0"]),
        ],
    )
    values.update(overrides)
    provider = Provider(**values)
    _store(client).put(Collections.PROVIDERS, provider.id, provider.model_dump(mode="json"))
    return provider


def test_overview_of_seeded_provider_has_full_shape(client):
    provider = _seed_provider(
        client,
        "ov-local",
        name="Local Overview",
        location="studio",
        status="degraded",
        metadata={"runtime": "comfyui", "gpu": "local"},
    )

    response = _overview(client, provider.id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["provider_id"] == "ov-local"
    assert body["name"] == "Local Overview"
    assert body["location"] == "studio"
    assert body["status"] == "degraded"
    assert body["metadata"] == {"runtime": "comfyui", "gpu": "local"}
    assert body["operation_ids"] == ["text-to-image"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {
        "capabilities": 1,
        "advertised_operations": 1,
        "catalog_operations": 1,
        "schema_versions": 1,
    }
    assert body["generated_at"]


def test_catalog_operations_join_title_and_schema_match(client):
    from app.schemas.provider import ProviderCapability

    _seed_provider(
        client,
        "ov-catalog",
        capabilities=[
            ProviderCapability(operation_id="text-to-image", schema_versions=["1.0.0"]),
            ProviderCapability(operation_id="image-to-image", schema_versions=["2.0.0"]),
        ],
    )

    body = _overview(client, "ov-catalog").json()
    operations = body["catalog_operations"]
    assert len(operations) == 2
    assert all(set(op) == _OPERATION_KEYS for op in operations)
    by_id = {op["operation_id"]: op for op in operations}
    assert by_id["text-to-image"]["title"] == "Text to image"
    assert by_id["text-to-image"]["catalog_version"] == "1.0.0"
    assert by_id["text-to-image"]["advertised_versions"] == ["1.0.0"]
    assert by_id["text-to-image"]["schema_match"] is True
    assert by_id["image-to-image"]["catalog_version"] == "1.0.0"
    assert by_id["image-to-image"]["advertised_versions"] == ["2.0.0"]
    assert by_id["image-to-image"]["schema_match"] is False


def test_operation_ids_sorted_deduplicated_and_versions_sorted(client):
    from app.schemas.provider import ProviderCapability

    _seed_provider(
        client,
        "ov-order",
        capabilities=[
            ProviderCapability(operation_id="upscale", schema_versions=["2.0.0"]),
            ProviderCapability(
                operation_id="text-to-image", schema_versions=["1.1.0", "1.0.0"]
            ),
            ProviderCapability(operation_id="text-to-image", schema_versions=["1.0.0"]),
            ProviderCapability(operation_id="upscale", schema_versions=["1.0.0"]),
        ],
    )

    body = _overview(client, "ov-order").json()
    assert body["operation_ids"] == ["text-to-image", "upscale"]
    assert body["counts"]["capabilities"] == 4
    assert body["counts"]["advertised_operations"] == 2
    assert body["counts"]["schema_versions"] == 3
    text_to_image = next(
        op for op in body["catalog_operations"] if op["operation_id"] == "text-to-image"
    )
    assert text_to_image["advertised_versions"] == ["1.0.0", "1.1.0"]
    upscale = next(op for op in body["catalog_operations"] if op["operation_id"] == "upscale")
    assert upscale["advertised_versions"] == ["1.0.0", "2.0.0"]


def test_non_catalog_operations_are_advertised_but_not_bound(client):
    from app.schemas.provider import ProviderCapability

    _seed_provider(
        client,
        "ov-unknown",
        capabilities=[
            ProviderCapability(operation_id="catalog-op", schema_versions=["1.0.0"]),
            ProviderCapability(operation_id="retired-op", schema_versions=["1.0.0"]),
        ],
    )

    body = _overview(client, "ov-unknown").json()
    assert body["operation_ids"] == ["catalog-op", "retired-op"]
    assert body["counts"]["advertised_operations"] == 2
    assert body["counts"]["catalog_operations"] == 0
    assert body["catalog_operations"] == []


def test_overview_without_capabilities_is_zero_filled(client):
    _seed_provider(client, "ov-empty", capabilities=[])

    body = _overview(client, "ov-empty").json()
    assert body["operation_ids"] == []
    assert body["catalog_operations"] == []
    assert body["counts"] == {
        "capabilities": 0,
        "advertised_operations": 0,
        "catalog_operations": 0,
        "schema_versions": 0,
    }


def test_seeded_registry_provider_is_derivable(client):
    # The default registry seeds local-comfyui without any test fixtures.
    body = _overview(client, "local-comfyui").json()
    assert body["name"] == "Local ComfyUI"
    assert body["status"] == "available"
    assert body["operation_ids"] == ["image-to-image", "text-to-image", "upscale"]
    assert body["counts"]["catalog_operations"] == 3
    assert all(op["schema_match"] for op in body["catalog_operations"])


def test_unknown_provider_uses_shared_404_envelope(client):
    response = _overview(client, f"missing-{uuid4().hex}")
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "provider_not_found"
    assert error["request_id"]


def test_literal_overview_path_is_not_parsed_as_provider_id(client):
    _seed_provider(client, "ov-literal")
    response = client.get(f"{PREFIX}/providers/ov-literal/overview")
    assert response.status_code == 200
    assert response.json()["provider_id"] == "ov-literal"
