"""Authoritative conversation-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "conversation_id",
    "project_id",
    "project_name",
    "title",
    "message_count",
    "last_message_role",
    "last_message_excerpt",
    "created_at",
    "updated_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/conversations/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Feed Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _conversation(client, project_id, title, *, initial_message=None):
    response = client.post(
        f"{PREFIX}/projects/{project_id}/conversations",
        json={"title": title, "initial_message": initial_message},
    )
    assert response.status_code == 201
    return response.json()


def _message(client, conversation_id, content, *, role="assistant"):
    response = client.post(
        f"{PREFIX}/conversations/{conversation_id}/messages",
        json={"role": role, "content": content},
    )
    assert response.status_code == 201
    return response.json()


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["updated_at"], item["conversation_id"]),
        reverse=True,
    )


def test_conversation_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_conversation_feed_is_newest_first_with_preview_and_project_identity(client):
    _clear(client)
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]

    c1 = _conversation(client, p1, "Roadmap", initial_message="First idea")
    c2 = _conversation(client, p1, "Shot plan")  # starts empty
    c3 = _conversation(client, p2, "Splat notes", initial_message="Reconstruction plan")
    _message(client, c2["id"], "Rendered preview of the shot.")

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)  # deterministic (updated_at, conversation_id) order

    by_id = {item["conversation_id"]: item for item in items}
    assert set(by_id) == {c1["id"], c2["id"], c3["id"]}
    assert set(by_id[c1["id"]]) == _ITEM_KEYS

    first = by_id[c1["id"]]
    assert first["title"] == "Roadmap"
    assert first["project_id"] == p1
    assert first["project_name"] == "Alpha"
    assert first["message_count"] == 1
    assert first["last_message_role"] == "user"
    assert first["last_message_excerpt"] == "First idea"
    assert first["created_at"] and first["updated_at"]

    replied = by_id[c2["id"]]
    assert replied["message_count"] == 1
    assert replied["last_message_role"] == "assistant"
    assert replied["last_message_excerpt"] == "Rendered preview of the shot."

    other = by_id[c3["id"]]
    assert other["project_id"] == p2
    assert other["project_name"] == "Beta"
    assert other["last_message_excerpt"] == "Reconstruction plan"


def test_conversation_feed_empty_conversation_has_no_message_preview(client):
    _clear(client)
    project_id = _project(client)["id"]
    conversation = _conversation(client, project_id, "Untitled thread")

    item = _feed(client).json()["items"][0]
    assert item["message_count"] == 0
    assert item["last_message_role"] is None
    assert item["last_message_excerpt"] is None
    assert item["title"] == "Untitled thread"
    assert item["conversation_id"] == conversation["id"]


def test_conversation_feed_project_scope_narrows_derivation(client):
    _clear(client)
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]
    c1 = _conversation(client, p1, "Alpha thread")
    _conversation(client, p2, "Beta thread")

    scoped = _feed(client, project_id=p1).json()
    assert scoped["total"] == 1
    assert [item["conversation_id"] for item in scoped["items"]] == [c1["id"]]
    assert scoped["items"][0]["project_name"] == "Alpha"

    assert _feed(client).json()["total"] == 2
    assert _feed(client, project_id=p2).json()["total"] == 1


def test_conversation_feed_limit_bounds_page_but_not_total(client):
    _clear(client)
    project_id = _project(client)["id"]
    for index in range(4):
        _conversation(client, project_id, f"Thread {index}")

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_conversation_feed_total_agrees_with_conversation_stats(client):
    _clear(client)
    p1 = _project(client, "Alpha")["id"]
    p2 = _project(client, "Beta")["id"]
    c1 = _conversation(client, p1, "Roadmap", initial_message="First idea")
    _conversation(client, p1, "Shot plan")
    c3 = _conversation(client, p2, "Splat notes", initial_message="Reconstruction plan")
    _message(client, c3["id"], "More context")

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/conversations/stats").json()
    assert feed["total"] == stats["total_conversations"] == 3
    assert sum(item["message_count"] for item in feed["items"]) == 3
    assert {c1["id"], c3["id"]} <= {item["conversation_id"] for item in feed["items"]}


def test_conversation_feed_excerpt_is_truncated_and_whitespace_normalized(client):
    _clear(client)
    project_id = _project(client)["id"]
    conversation = _conversation(client, project_id, "Long thread")
    _message(client, conversation["id"], "  line one\nline two  " + "x" * 300)

    excerpt = _feed(client).json()["items"][0]["last_message_excerpt"]
    assert excerpt.startswith("line one line two")
    assert excerpt.endswith("…")
    assert len(excerpt) == 161  # 160 chars + ellipsis


def test_conversation_feed_unknown_project_uses_shared_404_envelope(client):
    _clear(client)
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"
    assert response.headers["X-Request-ID"]


def test_conversation_feed_malformed_project_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_conversation_feed_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
