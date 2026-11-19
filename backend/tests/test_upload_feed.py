"""Authoritative upload-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "upload_id",
    "project_id",
    "project_name",
    "filename",
    "content_type",
    "status",
    "declared_size",
    "size_bytes",
    "created_at",
    "expires_at",
}
_BYTES = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def _feed(client, **params):
    return client.get(f"{PREFIX}/uploads/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Feed Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _ticket(client, project_id, *, filename="shot.png", content_type="image/png", size=128):
    response = client.post(
        f"{PREFIX}/uploads",
        json={
            "project_id": project_id,
            "filename": filename,
            "content_type": content_type,
            "size_bytes": size,
        },
    )
    assert response.status_code == 201
    return response.json()


def _complete(client, ticket, content=_BYTES):
    response = client.put(ticket["url"], content=content)
    assert response.status_code == 204


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["upload_id"]),
        reverse=True,
    )


def test_upload_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_upload_feed_is_newest_first_with_ticket_and_project_identity(client):
    _clear(client)
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]

    t1 = _ticket(client, p1, filename="hero.png", content_type="image/png", size=100)
    t2 = _ticket(client, p1, filename="clip.mov", content_type="video/quicktime", size=512)
    t3 = _ticket(client, p2, filename="scene.exr", content_type="image/x-exr", size=256)
    _complete(client, t2)

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)  # deterministic (created_at, upload_id) newest-first

    by_id = {item["upload_id"]: item for item in items}
    assert set(by_id) == {t1["upload_id"], t2["upload_id"], t3["upload_id"]}
    assert set(by_id[t1["upload_id"]]) == _ITEM_KEYS

    first = by_id[t1["upload_id"]]
    assert first["filename"] == "hero.png"
    assert first["content_type"] == "image/png"
    assert first["project_id"] == p1
    assert first["project_name"] == "Alpha"
    assert first["status"] == "pending"
    assert first["declared_size"] == 100
    assert first["size_bytes"] == 0
    assert first["created_at"] and first["expires_at"]

    completed = by_id[t2["upload_id"]]
    assert completed["filename"] == "clip.mov"
    assert completed["project_name"] == "Alpha"
    assert completed["status"] == "complete"
    assert completed["size_bytes"] == len(_BYTES)

    other = by_id[t3["upload_id"]]
    assert other["project_id"] == p2
    assert other["project_name"] == "Beta"
    assert other["content_type"] == "image/x-exr"


def test_upload_feed_project_scope_narrows_derivation(client):
    _clear(client)
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]
    t1 = _ticket(client, p1)
    _ticket(client, p2)

    scoped = _feed(client, project_id=p1).json()
    assert scoped["total"] == 1
    assert [item["upload_id"] for item in scoped["items"]] == [t1["upload_id"]]
    assert scoped["items"][0]["project_name"] == "Alpha"

    # Whole workspace still sees every ticket.
    assert _feed(client).json()["total"] == 2
    assert _feed(client, project_id=p2).json()["total"] == 1


def test_upload_feed_limit_bounds_page_but_not_total(client):
    _clear(client)
    project_id = _project(client)["id"]
    for index in range(4):
        _ticket(client, project_id, filename=f"asset-{index}.png")

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_upload_feed_total_agrees_with_upload_stats(client):
    _clear(client)
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]
    t1 = _ticket(client, p1, size=10)
    t2 = _ticket(client, p1, size=20)
    t3 = _ticket(client, p2, size=30)
    _complete(client, t1, content=b"a" * 7)
    _complete(client, t3, content=b"b" * 11)
    # t2 stays pending.

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/uploads/stats").json()
    assert feed["total"] == stats["total_tickets"] == 3
    assert stats["pending"] == 1
    assert stats["completed"] == 2
    assert sum(item["size_bytes"] for item in feed["items"]) == stats["bytes_uploaded"] == 18


def test_upload_feed_unknown_project_uses_shared_404_envelope(client):
    _clear(client)
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"
    assert response.headers["X-Request-ID"]


def test_upload_feed_malformed_project_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_upload_feed_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
