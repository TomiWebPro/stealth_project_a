"""Authoritative conversation-overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "conversation_id",
    "project_id",
    "project_name",
    "title",
    "created_by",
    "created_at",
    "updated_at",
    "message_count",
    "last_message_role",
    "last_message_excerpt",
    "counts",
    "recent_messages",
    "generated_at",
}
_COUNT_KEYS = {"total", "by_role", "by_status"}
_ROLES = ["system", "user", "assistant", "tool"]
_STATUSES = ["pending", "streaming", "complete", "error"]


def _overview(client, conversation_id, **params):
    return client.get(f"{PREFIX}/conversations/{conversation_id}/overview", params=params)


def _store(client):
    return client.app.state.store


def _project(client, name="Overview Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _conversation(client, project_id, title, *, initial_message=None):
    response = client.post(
        f"{PREFIX}/projects/{project_id}/conversations",
        json={"title": title, "initial_message": initial_message},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _message(client, conversation_id, content, *, role="assistant"):
    response = client.post(
        f"{PREFIX}/conversations/{conversation_id}/messages",
        json={"role": role, "content": content},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _seed_message(client, conversation_id, *, role="user", status="complete", content="x", created_at=None):
    from app.schemas.common import utcnow
    from app.schemas.conversation import Message

    record = Message(
        id=uuid4(),
        conversation_id=conversation_id,
        role=role,
        content=content,
        status=status,
        created_at=created_at or utcnow(),
    )
    _store(client).put("messages", str(record.id), record.model_dump(mode="json"))
    return record


def _seed_orphan_conversation(client, name="Orphan conversation"):
    from app.schemas.common import utcnow
    from app.schemas.conversation import Conversation

    now = utcnow()
    conversation = Conversation(
        id=uuid4(),
        project_id=uuid4(),
        title=name,
        created_by=uuid4(),
        created_at=now,
        updated_at=now,
    )
    _store(client).put("conversations", str(conversation.id), conversation.model_dump(mode="json"))
    return conversation


def test_overview_of_fresh_conversation(client):
    project = _project(client, "Fresh")
    conversation = _conversation(client, project["id"], "Fresh chat", initial_message="Hello")

    response = _overview(client, conversation["id"])
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["conversation_id"] == conversation["id"]
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Fresh"
    assert body["title"] == "Fresh chat"
    assert body["created_by"] == conversation["created_by"]
    assert body["created_at"] == conversation["created_at"]
    assert body["updated_at"] == conversation["updated_at"]
    assert body["message_count"] == 1
    assert body["last_message_role"] == "user"
    assert body["last_message_excerpt"] == "Hello"
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"]["total"] == 1
    assert [bucket["role"] for bucket in body["counts"]["by_role"]] == _ROLES
    assert [bucket["status"] for bucket in body["counts"]["by_status"]] == _STATUSES
    assert next(b for b in body["counts"]["by_role"] if b["role"] == "user")["count"] == 1
    assert next(b for b in body["counts"]["by_status"] if b["status"] == "complete")["count"] == 1
    assert len(body["recent_messages"]) == 1
    assert body["recent_messages"][0]["content"] == "Hello"
    assert body["generated_at"]


def test_overview_of_empty_conversation_is_zero_filled(client):
    project = _project(client, "Empty")
    conversation = _conversation(client, project["id"], "No messages")

    body = _overview(client, conversation["id"]).json()
    assert body["message_count"] == 0
    assert body["last_message_role"] is None
    assert body["last_message_excerpt"] is None
    assert body["counts"]["total"] == 0
    assert all(bucket["count"] == 0 for bucket in body["counts"]["by_role"])
    assert all(bucket["count"] == 0 for bucket in body["counts"]["by_status"])
    assert body["recent_messages"] == []


def test_overview_breaks_down_roles_and_statuses(client):
    project = _project(client, "Breakdown")
    conversation = _conversation(client, project["id"], "Mixed")

    _seed_message(client, conversation["id"], role="user", status="complete", content="u1")
    _seed_message(client, conversation["id"], role="user", status="complete", content="u2")
    _seed_message(client, conversation["id"], role="assistant", status="streaming", content="a1")
    _seed_message(client, conversation["id"], role="tool", status="error", content="t1")

    body = _overview(client, conversation["id"]).json()
    assert body["counts"]["total"] == 4
    assert {b["role"]: b["count"] for b in body["counts"]["by_role"]} == {
        "system": 0,
        "user": 2,
        "assistant": 1,
        "tool": 1,
    }
    assert {b["status"]: b["count"] for b in body["counts"]["by_status"]} == {
        "pending": 0,
        "streaming": 1,
        "complete": 2,
        "error": 1,
    }


def test_overview_counts_all_messages_but_bounds_recent_page(client):
    from datetime import datetime, timezone

    project = _project(client, "Recent")
    conversation = _conversation(client, project["id"], "Long chat")

    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for index in range(4):
        _seed_message(
            client,
            conversation["id"],
            content=f"message-{index}",
            created_at=(base + timedelta(minutes=index)).isoformat().replace("+00:00", "Z"),
        )

    full = _overview(client, conversation["id"]).json()
    assert full["counts"]["total"] == 4
    assert [item["content"] for item in full["recent_messages"]] == [
        "message-3",
        "message-2",
        "message-1",
        "message-0",
    ]
    assert full["last_message_role"] == "user"

    bounded = _overview(client, conversation["id"], recent_limit=2).json()
    assert bounded["counts"]["total"] == 4  # count not bounded by the page
    assert [item["content"] for item in bounded["recent_messages"]] == ["message-3", "message-2"]
    assert bounded["last_message_excerpt"] == "message-3"


def test_overview_last_message_uses_deterministic_tie_break_and_excerpt(client):
    from datetime import datetime, timezone

    project = _project(client, "Ties")
    conversation = _conversation(client, project["id"], "Tied")
    same_time = datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")

    first = _seed_message(client, conversation["id"], content="  first\nline ", created_at=same_time)
    second = _seed_message(
        client,
        conversation["id"],
        role="assistant",
        content="second   line",
        created_at=same_time,
    )

    body = _overview(client, conversation["id"]).json()
    newest = max((first, second), key=lambda message: str(message.id))
    assert body["last_message_role"] == newest.role
    assert body["last_message_excerpt"] == " ".join(newest.content.split())
    assert [item["content"] for item in body["recent_messages"]] == [
        newest.content,
        min((first, second), key=lambda message: str(message.id)).content,
    ]


def test_overview_joins_project_name_with_orphan_fallback(client):
    project = _project(client, "Joined")
    conversation = _conversation(client, project["id"], "In project")
    assert _overview(client, conversation["id"]).json()["project_name"] == "Joined"

    orphan = _seed_orphan_conversation(client)
    assert _overview(client, orphan.id).json()["project_name"] == "Unknown project"


def test_unknown_conversation_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "conversation_not_found"
    assert error["request_id"]


def test_malformed_conversation_id_uses_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/conversations/not-a-uuid/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    project = _project(client, "Limits")
    conversation = _conversation(client, project["id"], "Limited")
    for limit in (0, 51):
        response = _overview(client, conversation["id"], recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
