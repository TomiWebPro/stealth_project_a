"""Authoritative operation-overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "operation_id",
    "title",
    "description",
    "schema_version",
    "input_types",
    "output_types",
    "setting_keys",
    "streaming",
    "provider_ids",
    "provider_bindings",
    "counts",
    "generated_at",
}
_COUNT_KEYS = {
    "settings",
    "input_types",
    "output_types",
    "provider_bindings",
    "matching_providers",
}
_BINDING_KEYS = {
    "provider_id",
    "name",
    "location",
    "status",
    "advertised_versions",
    "schema_match",
}


def _overview(client, operation_id):
    return client.get(f"{PREFIX}/operations/{operation_id}/overview")


def _store(client):
    return client.app.state.store


def _seed_provider(client, provider_id, **overrides):
    """Write a Provider straight to the authoritative store with deterministic data."""
    from app.schemas.provider import Provider
    from app.storage.base import Collections

    values = dict(
        id=provider_id,
        name=f"Provider {provider_id}",
        location="local",
        status="available",
        capabilities=[],
    )
    values.update(overrides)
    provider = Provider(**values)
    _store(client).put(Collections.PROVIDERS, provider.id, provider.model_dump(mode="json"))
    return provider


def _capability(operation_id, *versions):
    from app.schemas.provider import ProviderCapability

    return ProviderCapability(operation_id=operation_id, schema_versions=list(versions))


def test_catalog_operation_has_full_shape(client):
    # text-to-image: 1 input type, 1 output type, 3 settings, streaming off,
    # catalog bindings local-comfyui + cloud-render (both seeded as advertisers).
    response = _overview(client, "text-to-image")
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["operation_id"] == "text-to-image"
    assert body["title"] == "Text to image"
    assert body["schema_version"] == "1.0.0"
    assert body["input_types"] == []
    assert body["output_types"] == ["image"]
    assert body["setting_keys"] == ["height", "seed", "width"]
    assert body["streaming"] is False
    assert body["provider_ids"] == ["cloud-render", "local-comfyui"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"]["settings"] == 3
    assert body["counts"]["input_types"] == 0
    assert body["counts"]["output_types"] == 1
    assert body["counts"]["matching_providers"] == 2
    assert body["generated_at"]


def test_bindings_reflect_advertising_fleet_and_schema_drift(client):
    _seed_provider(
        client,
        "ov-a",
        name="Alpha",
        location="studio",
        status="degraded",
        capabilities=[
            _capability("text-to-image", "1.0.0"),
            _capability("text-to-image", "2.0.0"),  # duplicate op, extra version
            _capability("unrelated-op", "1.0.0"),
        ],
    )
    _seed_provider(
        client,
        "ov-b",
        name="Beta",
        location="cloud",
        capabilities=[_capability("text-to-image", "0.9.0")],  # schema drift
    )

    body = _overview(client, "text-to-image").json()
    bindings = body["provider_bindings"]
    # Seeded providers (local-comfyui, cloud-render) + the two on-demand ones.
    ids = [binding["provider_id"] for binding in bindings]
    assert ids == sorted(ids)
    assert {"ov-a", "ov-b", "cloud-render", "local-comfyui"} <= set(ids)
    assert all(set(binding) == _BINDING_KEYS for binding in bindings)

    by_id = {binding["provider_id"]: binding for binding in bindings}
    assert by_id["ov-a"]["name"] == "Alpha"
    assert by_id["ov-a"]["location"] == "studio"
    assert by_id["ov-a"]["status"] == "degraded"
    assert by_id["ov-a"]["advertised_versions"] == ["1.0.0", "2.0.0"]
    assert by_id["ov-a"]["schema_match"] is True
    assert by_id["ov-b"]["advertised_versions"] == ["0.9.0"]
    assert by_id["ov-b"]["schema_match"] is False

    assert body["counts"]["provider_bindings"] == len(bindings)
    assert body["counts"]["matching_providers"] == sum(
        1 for binding in bindings if binding["schema_match"]
    )


def test_declared_bindings_and_actual_bindings_can_differ(client):
    # text-to-text declares no catalog provider, yet local-llm advertises it.
    body = _overview(client, "text-to-text").json()
    assert body["provider_ids"] == []
    assert body["streaming"] is True
    bindings = {binding["provider_id"] for binding in body["provider_bindings"]}
    assert "local-llm" in bindings
    assert body["counts"]["provider_bindings"] == len(body["provider_bindings"])


def test_operation_with_no_advertising_provider_is_zero_filled(client):
    # flf2v has no declared provider bindings and no seeded provider advertises it.
    body = _overview(client, "flf2v").json()
    assert body["provider_ids"] == []
    assert body["provider_bindings"] == []
    assert body["counts"]["provider_bindings"] == 0
    assert body["counts"]["matching_providers"] == 0
    assert body["input_types"] == ["image"]
    assert body["output_types"] == ["video"]


def test_streaming_and_shape_counts(client):
    body = _overview(client, "dataset-prep").json()
    assert body["setting_keys"] == ["trigger_word"]
    assert body["counts"]["settings"] == 1
    assert body["counts"]["input_types"] == 1
    assert body["counts"]["output_types"] == 1


def test_unknown_operation_uses_shared_404_envelope(client):
    response = _overview(client, f"missing-{uuid4().hex}")
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "operation_not_found"
    assert error["request_id"]


def test_literal_overview_path_is_not_parsed_as_operation_id(client):
    # A real operation id plus the literal suffix resolves the overview, not the
    # plain /operations/{operation_id} detail route.
    response = client.get(f"{PREFIX}/operations/upscale/overview")
    assert response.status_code == 200
    assert response.json()["operation_id"] == "upscale"
