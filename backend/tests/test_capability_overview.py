"""Authoritative capability-overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from .conftest import PREFIX

_KEYS = {
    "operation_id",
    "in_catalog",
    "catalog_title",
    "catalog_version",
    "providers",
    "counts",
    "generated_at",
}
_COUNT_KEYS = {
    "total_providers",
    "available",
    "degraded",
    "unavailable",
    "locations",
    "schema_versions",
}
_PROVIDER_KEYS = {
    "provider_id",
    "name",
    "location",
    "status",
    "schema_versions",
    "schema_match",
}


def _overview(client, operation_id):
    return client.get(f"{PREFIX}/capabilities/{operation_id}/overview")


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


def test_catalog_capability_has_full_shape(client):
    from app.schemas.provider import ProviderCapability

    # "3d-reconstruction" is in the catalog but no seeded provider advertises it,
    # so this test exercises a fully controlled provider set.
    _seed_provider(
        client,
        "cap-local",
        name="Capability Local",
        location="local",
        status="available",
        capabilities=[
            ProviderCapability(operation_id="3d-reconstruction", schema_versions=["1.0.0"]),
        ],
    )

    response = _overview(client, "3d-reconstruction")
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["operation_id"] == "3d-reconstruction"
    assert body["in_catalog"] is True
    assert body["catalog_title"] == "3D reconstruction"
    assert body["catalog_version"] == "1.0.0"
    assert len(body["providers"]) == 1
    provider = body["providers"][0]
    assert set(provider) == _PROVIDER_KEYS
    assert provider["provider_id"] == "cap-local"
    assert provider["name"] == "Capability Local"
    assert provider["location"] == "local"
    assert provider["status"] == "available"
    assert provider["schema_versions"] == ["1.0.0"]
    assert provider["schema_match"] is True
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {
        "total_providers": 1,
        "available": 1,
        "degraded": 0,
        "unavailable": 0,
        "locations": 1,
        "schema_versions": 1,
    }
    assert body["generated_at"]


def test_providers_sorted_deduplicated_with_schema_versions(client):
    from app.schemas.provider import ProviderCapability

    _seed_provider(
        client,
        "cap-z",
        status="degraded",
        capabilities=[
            ProviderCapability(operation_id="3d-reconstruction", schema_versions=["1.1.0"]),
            ProviderCapability(operation_id="3d-reconstruction", schema_versions=["1.0.0", "1.1.0"]),
        ],
    )
    _seed_provider(
        client,
        "cap-a",
        location="cloud",
        status="unavailable",
        capabilities=[
            ProviderCapability(operation_id="3d-reconstruction", schema_versions=["1.0.0"]),
        ],
    )

    body = _overview(client, "3d-reconstruction").json()
    assert [item["provider_id"] for item in body["providers"]] == ["cap-a", "cap-z"]
    by_id = {item["provider_id"]: item for item in body["providers"]}
    assert by_id["cap-z"]["schema_versions"] == ["1.0.0", "1.1.0"]
    assert by_id["cap-a"]["schema_versions"] == ["1.0.0"]
    assert body["counts"] == {
        "total_providers": 2,
        "available": 0,
        "degraded": 1,
        "unavailable": 1,
        "locations": 2,
        "schema_versions": 2,
    }


def test_schema_match_flags_catalog_drift(client):
    from app.schemas.provider import ProviderCapability

    _seed_provider(
        client,
        "cap-match",
        capabilities=[ProviderCapability(operation_id="3d-reconstruction", schema_versions=["1.0.0"])],
    )
    _seed_provider(
        client,
        "cap-drift",
        capabilities=[ProviderCapability(operation_id="3d-reconstruction", schema_versions=["2.0.0"])],
    )

    body = _overview(client, "3d-reconstruction").json()
    by_id = {item["provider_id"]: item for item in body["providers"]}
    assert by_id["cap-match"]["schema_match"] is True
    assert by_id["cap-drift"]["schema_match"] is False
    assert body["counts"]["schema_versions"] == 2


def test_non_catalog_capability_from_provider_is_derivable(client):
    from app.schemas.provider import ProviderCapability

    _seed_provider(
        client,
        "cap-legacy",
        capabilities=[ProviderCapability(operation_id="retired-op", schema_versions=["0.9.0"])],
    )

    body = _overview(client, "retired-op").json()
    assert body["operation_id"] == "retired-op"
    assert body["in_catalog"] is False
    assert body["catalog_title"] is None
    assert body["catalog_version"] is None
    assert body["providers"][0]["provider_id"] == "cap-legacy"
    assert body["providers"][0]["schema_match"] is False
    assert body["counts"]["total_providers"] == 1


def test_catalog_capability_without_providers_is_zero_filled(client):
    # "dataset-prep" is in the catalog but no seeded provider advertises it.
    response = _overview(client, "dataset-prep")
    assert response.status_code == 200
    body = response.json()
    assert body["in_catalog"] is True
    assert body["catalog_title"] == "Dataset preparation"
    assert body["providers"] == []
    assert body["counts"] == {
        "total_providers": 0,
        "available": 0,
        "degraded": 0,
        "unavailable": 0,
        "locations": 0,
        "schema_versions": 0,
    }


def test_seeded_catalog_capability_is_derivable(client):
    # The default registry seeds local-comfyui + cloud-render for text-to-image.
    body = _overview(client, "text-to-image").json()
    provider_ids = {item["provider_id"] for item in body["providers"]}
    assert {"local-comfyui", "cloud-render"} <= provider_ids
    assert body["counts"]["total_providers"] == len(body["providers"])
    assert all(item["schema_match"] for item in body["providers"])
    assert body["counts"]["available"] + body["counts"]["degraded"] + body["counts"]["unavailable"] == body["counts"]["total_providers"]


def test_unknown_capability_uses_shared_404_envelope(client):
    response = _overview(client, "does-not-exist")
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "capability_not_found"
    assert error["request_id"]


def test_literal_overview_path_does_not_break_capability_query(client):
    # The existing capability-discovery endpoint must remain unaffected.
    listing = client.get(f"{PREFIX}/capabilities", params={"operation_id": "text-to-image"})
    assert listing.status_code == 200
    assert all(
        any(cap["operation_id"] == "text-to-image" for cap in provider["capabilities"])
        for provider in listing.json()
    )
    assert _overview(client, "text-to-image").status_code == 200
