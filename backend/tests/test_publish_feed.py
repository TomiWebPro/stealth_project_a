"""Authoritative publish-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}


def _feed(client, **params):
    return client.get(f"{PREFIX}/publishes", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Feed Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _storage(key="asset.png"):
    return {"key": key, "size_bytes": 16, "content_type": "image/png"}


def _asset(client, project_id, name="Asset", asset_type="image"):
    response = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project_id,
            "type": asset_type,
            "name": name,
            "storage": _storage(),
        },
    )
    assert response.status_code == 201
    return response.json()


def _receipt(*, version=1, size_bytes=100, published_at="2026-01-01T00:00:00"):
    return {
        "version": version,
        "version_folder": f"Ver_{version:03d}",
        "size_bytes": size_bytes,
        "published_at": published_at,
        "checksum_sha256": "deadbeef",
    }


def _publish(client, asset_id, receipt=None):
    response = client.patch(
        f"{PREFIX}/assets/{asset_id}",
        json={"metadata": {"publish_receipt": receipt if receipt is not None else _receipt()}},
    )
    assert response.status_code == 200
    return response.json()


def test_publish_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_publish_feed_is_newest_first_with_asset_and_project_identity(client):
    _clear(client)
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]

    a = _asset(client, p1, "Hero", "image")["id"]
    b = _asset(client, p1, "Trailer", "video")["id"]
    c = _asset(client, p2, "Environment", "splat")["id"]

    _publish(client, a, _receipt(version=1, size_bytes=100, published_at="2026-01-01T00:00:00"))
    _publish(client, b, _receipt(version=2, size_bytes=250, published_at="2026-03-01T00:00:00"))
    _publish(client, c, _receipt(version=1, size_bytes=50, published_at="2026-02-01T00:00:00"))

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    # Newest first: B (Mar), C (Feb), A (Jan).
    assert [item["asset_id"] for item in body["items"]] == [b, c, a]
    assert [item["asset_name"] for item in body["items"]] == ["Trailer", "Environment", "Hero"]
    assert [item["asset_type"] for item in body["items"]] == ["video", "splat", "image"]
    assert [item["project_name"] for item in body["items"]] == ["Alpha", "Beta", "Alpha"]
    first = body["items"][0]
    assert set(first) == {
        "asset_id",
        "asset_name",
        "asset_type",
        "project_id",
        "project_name",
        "version",
        "size_bytes",
        "published_at",
    }
    assert first["version"] == 2
    assert first["size_bytes"] == 250
    assert first["published_at"] == "2026-03-01T00:00:00"


def test_publish_feed_project_scope_narrows_derivation(client):
    _clear(client)
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]
    a = _asset(client, p1, "Hero")["id"]
    _asset(client, p2, "Other")
    _publish(client, a)

    scoped = _feed(client, project_id=p1).json()
    assert scoped["total"] == 1
    assert [item["asset_id"] for item in scoped["items"]] == [a]
    assert scoped["items"][0]["project_name"] == "Alpha"

    # Whole workspace still sees every published asset.
    assert _feed(client).json()["total"] == 1
    assert _feed(client, project_id=p2).json()["total"] == 0


def test_publish_feed_limit_bounds_page_but_not_total(client):
    _clear(client)
    project_id = _project(client)["id"]
    asset_ids = []
    for index in range(4):
        asset_id = _asset(client, project_id, f"Asset {index}")["id"]
        asset_ids.append(asset_id)
        _publish(client, asset_id, _receipt(published_at=f"2026-01-0{index + 1}T00:00:00"))

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert [item["asset_id"] for item in body["items"]] == list(reversed(asset_ids))[:2]


def test_publish_feed_excludes_deleted_and_invalid_receipts(client):
    _clear(client)
    project_id = _project(client)["id"]
    good = _asset(client, project_id, "Good")["id"]
    unpublished = _asset(client, project_id, "Unpublished")["id"]
    malformed = _asset(client, project_id, "Malformed")["id"]
    deleted = _asset(client, project_id, "Deleted")["id"]

    _publish(client, good)
    _publish(client, malformed, _receipt(version=0))  # version < 1 is invalid
    _publish(client, deleted)
    client.delete(f"{PREFIX}/assets/{deleted}")

    body = _feed(client).json()
    assert body["total"] == 1
    assert [item["asset_id"] for item in body["items"]] == [good]
    assert unpublished not in [item["asset_id"] for item in body["items"]]


def test_publish_feed_total_agrees_with_publish_stats(client):
    _clear(client)
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]
    for project_id, name in ((p1, "A"), (p1, "B"), (p2, "C")):
        asset_id = _asset(client, project_id, name)["id"]
        _publish(client, asset_id, _receipt(size_bytes=42))

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/publishes/stats").json()
    assert feed["total"] == stats["total_published"] == 3
    assert sum(item["size_bytes"] for item in feed["items"]) == stats["total_bytes"]


def test_publish_feed_unknown_project_uses_shared_404_envelope(client):
    _clear(client)
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"
    assert response.headers["X-Request-ID"]


def test_publish_feed_malformed_project_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_publish_feed_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
