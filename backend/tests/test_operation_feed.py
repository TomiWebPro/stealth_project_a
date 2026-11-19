"""Authoritative operation-catalog feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "operation_id",
    "title",
    "description",
    "schema_version",
    "input_types",
    "output_types",
    "settings_count",
    "streaming",
    "provider_ids",
    "provider_count",
}

# Ascending (title, operation_id) over the authoritative catalog.
_ALL_IDS = [
    "3d-reconstruction",
    "dataset-prep",
    "flf2v",
    "splat-train",
    "image-to-image",
    "image-to-video",
    "lora-train",
    "text-to-image",
    "text-to-text",
    "upscale",
]


def _feed(client, **params):
    return client.get(f"{PREFIX}/operations/feed", params=params)


def test_operation_feed_shape_and_deterministic_order(client):
    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == len(_ALL_IDS)
    assert body["generated_at"]
    items = body["items"]
    assert len(items) == len(_ALL_IDS)
    for item in items:
        assert set(item) == _ITEM_KEYS

    assert [item["operation_id"] for item in items] == _ALL_IDS
    # Titles are ascending (the secondary id tie-break is stable across backends).
    titles = [item["title"] for item in items]
    assert titles == sorted(titles)


def test_operation_feed_projects_catalog_fields(client):
    items = {item["operation_id"]: item for item in _feed(client).json()["items"]}

    t2i = items["text-to-image"]
    assert t2i["title"] == "Text to image"
    assert t2i["description"] == "Generate an image from a text prompt."
    assert t2i["schema_version"] == "1.0.0"
    assert t2i["output_types"] == ["image"]
    assert t2i["input_types"] == []
    assert t2i["settings_count"] == 3
    assert t2i["streaming"] is False
    # Provider bindings are sorted and deduplicated; count matches the list.
    assert t2i["provider_ids"] == ["cloud-render", "local-comfyui"]
    assert t2i["provider_count"] == 2

    i2i = items["image-to-image"]
    assert i2i["input_types"] == ["image"]
    assert i2i["settings_count"] == 1

    t2t = items["text-to-text"]
    assert t2t["streaming"] is True
    assert t2t["output_types"] == ["document"]
    assert t2t["provider_ids"] == []
    assert t2t["provider_count"] == 0


def test_operation_feed_streaming_filter_narrows_items_and_total(client):
    streaming = _feed(client, streaming=True).json()
    assert streaming["total"] == 1
    assert [item["operation_id"] for item in streaming["items"]] == ["text-to-text"]

    non_streaming = _feed(client, streaming=False).json()
    assert non_streaming["total"] == len(_ALL_IDS) - 1
    assert "text-to-text" not in {item["operation_id"] for item in non_streaming["items"]}


def test_operation_feed_provider_filter_narrows_items_and_total(client):
    by_provider = _feed(client, provider_id="local-comfyui").json()
    assert by_provider["total"] == 2
    assert {item["operation_id"] for item in by_provider["items"]} == {
        "text-to-image",
        "image-to-image",
    }

    trainer = _feed(client, provider_id="studio-trainer").json()
    assert {item["operation_id"] for item in trainer["items"]} == {
        "lora-train",
        "splat-train",
    }


def test_operation_feed_unknown_provider_is_zero_filled(client):
    body = _feed(client, provider_id="does-not-exist").json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_operation_feed_limit_bounds_page_but_not_total(client):
    body = _feed(client, limit=3).json()
    assert body["total"] == len(_ALL_IDS)
    assert len(body["items"]) == 3
    assert [item["operation_id"] for item in body["items"]] == _ALL_IDS[:3]


def test_operation_feed_total_agrees_with_operation_stats(client):
    stats = client.get(f"{PREFIX}/operations/stats").json()
    assert _feed(client).json()["total"] == stats["total"]
    # Filters are reflected in both views where they overlap.
    assert _feed(client, streaming=True).json()["total"] == stats["streaming"]


def test_operation_feed_literal_route_wins_over_operation_id(client):
    feed_response = _feed(client)
    assert feed_response.status_code == 200
    assert set(feed_response.json()) == _KEYS

    # The templated detail route still resolves a regular operation id.
    detail = client.get(f"{PREFIX}/operations/text-to-text")
    assert detail.status_code == 200
    assert detail.json()["id"] == "text-to-text"


def test_operation_feed_invalid_limit_uses_shared_422_envelope(client):
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert error["request_id"] == response.headers["X-Request-ID"]


def test_operation_feed_invalid_streaming_uses_shared_422_envelope(client):
    response = _feed(client, streaming="maybe")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]
