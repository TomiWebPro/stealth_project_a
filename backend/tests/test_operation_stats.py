"""Authoritative operation catalog statistics endpoint tests."""

from __future__ import annotations

from .conftest import PREFIX

_KEYS = {
    "total",
    "streaming",
    "with_provider",
    "without_provider",
    "total_settings",
    "unique_output_types",
    "by_output_type",
    "by_input_type",
    "generated_at",
}


def _stats(client):
    return client.get(f"{PREFIX}/operations/stats")


def _set_catalog(monkeypatch, specs) -> None:
    """Swap the catalog slice the repository reads, restoring it on teardown."""
    import app.repositories.operation_stats as module

    monkeypatch.setattr(module.OPERATION_CATALOG, "operations", list(specs))


def _spec(
    operation_id,
    *,
    input_types=(),
    output_types=(),
    streaming=False,
    provider_ids=(),
    settings=0,
):
    from app.schemas.operation import OperationIO, OperationSetting, OperationSpec

    return OperationSpec(
        id=operation_id,
        title=operation_id,
        schema_version="1.0.0",
        input=OperationIO(asset_types=list(input_types)),
        output=OperationIO(asset_types=list(output_types)),
        settings=[
            OperationSetting(key=f"k{i}", label=f"K{i}", type="string")
            for i in range(settings)
        ],
        streaming=streaming,
        provider_ids=list(provider_ids),
    )


def test_operation_stats_derives_builtin_catalog(client):
    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 10
    assert body["streaming"] == 1
    assert body["with_provider"] == 5
    assert body["without_provider"] == 5
    assert body["total_settings"] == 8
    assert body["unique_output_types"] == 7
    assert body["by_output_type"] == [
        {"asset_type": "image", "operations": 3},
        {"asset_type": "video", "operations": 2},
        {"asset_type": "dataset", "operations": 1},
        {"asset_type": "document", "operations": 1},
        {"asset_type": "lora", "operations": 1},
        {"asset_type": "model3d", "operations": 1},
        {"asset_type": "splat", "operations": 1},
    ]
    assert body["by_input_type"] == [
        {"asset_type": "image", "operations": 5},
        {"asset_type": "dataset", "operations": 1},
        {"asset_type": "model3d", "operations": 1},
        {"asset_type": "video", "operations": 1},
    ]
    assert body["generated_at"]


def test_operation_stats_keeps_operation_detail_route(client):
    """The literal /operations/stats route must not shadow /operations/{id}."""
    assert client.get(f"{PREFIX}/operations/stats").status_code == 200
    detail = client.get(f"{PREFIX}/operations/text-to-image")
    assert detail.status_code == 200
    assert detail.json()["id"] == "text-to-image"


def test_operation_stats_empty_catalog_is_zero_filled(client, monkeypatch):
    _set_catalog(monkeypatch, [])

    body = _stats(client).json()
    assert body["total"] == 0
    assert body["streaming"] == 0
    assert body["with_provider"] == 0
    assert body["without_provider"] == 0
    assert body["total_settings"] == 0
    assert body["unique_output_types"] == 0
    assert body["by_output_type"] == []
    assert body["by_input_type"] == []
    assert body["generated_at"]


def test_operation_stats_derives_custom_catalog(client, monkeypatch):
    _set_catalog(
        monkeypatch,
        [
            _spec(
                "a",
                input_types=["image", "text"],
                output_types=["image"],
                streaming=True,
                provider_ids=["p1"],
                settings=2,
            ),
            _spec("b", input_types=["image"], output_types=["video"]),
            _spec(
                "c",
                output_types=["image", "text"],
                provider_ids=["p2", "p3"],
                settings=1,
            ),
        ],
    )

    body = _stats(client).json()
    assert body["total"] == 3
    assert body["streaming"] == 1
    assert body["with_provider"] == 2
    assert body["without_provider"] == 1
    assert body["total_settings"] == 3
    assert body["unique_output_types"] == 3
    assert body["by_output_type"] == [
        {"asset_type": "image", "operations": 2},
        {"asset_type": "text", "operations": 1},
        {"asset_type": "video", "operations": 1},
    ]
    assert body["by_input_type"] == [
        {"asset_type": "image", "operations": 2},
        {"asset_type": "text", "operations": 1},
    ]


def test_operation_stats_is_derived_live_from_catalog(client, monkeypatch):
    _set_catalog(monkeypatch, [])
    assert _stats(client).json()["total"] == 0

    _set_catalog(monkeypatch, [_spec("x", output_types=["image"], streaming=True)])
    first = _stats(client).json()
    assert first["total"] == 1
    assert first["streaming"] == 1
    assert first["by_output_type"] == [{"asset_type": "image", "operations": 1}]

    # A second swap is reflected on the next call without any rebuild.
    _set_catalog(monkeypatch, [_spec("y"), _spec("z")])
    second = _stats(client).json()
    assert second["total"] == 2
    assert second["streaming"] == 0
    assert second["by_output_type"] == []


def test_operation_stats_is_stable_across_repeated_calls(client):
    first = _stats(client).json()
    second = _stats(client).json()
    first.pop("generated_at")
    second.pop("generated_at")
    assert first == second
