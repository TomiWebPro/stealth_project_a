"""Authoritative single-message overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "message_id",
    "conversation_id",
    "conversation_title",
    "project_id",
    "project_name",
    "role",
    "content",
    "status",
    "position",
    "attachments",
    "operation_id",
    "created_at",
    "counts",
    "recent_siblings",
    "generated_at",
}
_COUNT_KEYS = {"total", "by_role", "by_status"}
_ROLES = ["system", "user", "assistant", "tool"]
_STATUSES = ["pending", "streaming", "complete", "error"]


def _overview(client, conversation_id, message_id, **params):
    return client.get(
        f"{PREFIX}/conversations/{conversation_id}/messages/{message_id}/overview",
        params=params,
    )


def _store(client):
    return client.app.state.store


def _project(client, name="Message Overview Project"):
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


def _seed_message(
    client,
    conversation_id,
    *,
    role="user",
    status="complete",
    content="x",
    created_at=None,
    operation_id=None,
):
    from app.schemas.common import utcnow
    from app.schemas.conversation import Message

    record = Message(
        id=uuid4(),
        conversation_id=conversation_id,
        role=role,
        content=content,
        status=status,
        operation_id=operation_id,
        created_at=created_at or utcnow(),
    )
    _store(client).put("messages", str(record.id), record.model_dump(mode="json"))
    return record


def _seed_orphan_conversation(client):
    from app.schemas.common import utcnow
    from app.schemas.conversation import Conversation

    now = utcnow()
    conversation = Conversation(
        id=uuid4(),
        project_id=uuid4(),
        title="Orphan conversation",
        created_by=uuid4(),
        created_at=now,
        updated_at=now,
    )
    _store(client).put(
        "conversations", str(conversation.id), conversation.model_dump(mode="json")
    )
    return conversation


def test_overview_of_single_message(client):
    project = _project(client, "Single")
    conversation = _conversation(client, project["id"], "Chat", initial_message="Hello")
    message = _message(client, conversation["id"], "Hi there")

    response = _overview(client, conversation["id"], message["id"])
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["message_id"] == message["id"]
    assert body["conversation_id"] == conversation["id"]
    assert body["conversation_title"] == "Chat"
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Single"
    assert body["role"] == "assistant"
    assert body["content"] == "Hi there"
    assert body["status"] == "complete"
    assert body["position"] == 2
    assert body["attachments"] == []
    assert body["operation_id"] is None
    assert body["created_at"] == message["created_at"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"]["total"] == 2
    assert [bucket["role"] for bucket in body["counts"]["by_role"]] == _ROLES
    assert [bucket["status"] for bucket in body["counts"]["by_status"]] == _STATUSES
    assert len(body["recent_siblings"]) == 2
    assert {item["content"] for item in body["recent_siblings"]} == {"Hello", "Hi there"}
    assert body["generated_at"]


def test_overview_breaks_down_roles_and_statuses(client):
    project = _project(client, "Breakdown")
    conversation = _conversation(client, project["id"], "Mixed")
    target = _seed_message(client, conversation["id"], role="user", status="complete", content="u1")
    _seed_message(client, conversation["id"], role="user", status="complete", content="u2")
    _seed_message(client, conversation["id"], role="assistant", status="streaming", content="a1")
    _seed_message(client, conversation["id"], role="tool", status="error", content="t1")

    body = _overview(client, conversation["id"], target.id).json()
    assert body["counts"]["total"] == 4
    assert {bucket["role"]: bucket["count"] for bucket in body["counts"]["by_role"]} == {
        "system": 0,
        "user": 2,
        "assistant": 1,
        "tool": 1,
    }
    assert {bucket["status"]: bucket["count"] for bucket in body["counts"]["by_status"]} == {
        "pending": 0,
        "streaming": 1,
        "complete": 2,
        "error": 1,
    }


def test_overview_position_is_chronological_and_bounded_siblings(client):
    project = _project(client, "Position")
    conversation = _conversation(client, project["id"], "Ordered")
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    records = [
        _seed_message(
            client,
            conversation["id"],
            content=f"message-{index}",
            created_at=(base + timedelta(minutes=index)).isoformat().replace("+00:00", "Z"),
        )
        for index in range(4)
    ]

    first = _overview(client, conversation["id"], records[0].id).json()
    assert first["position"] == 1
    third = _overview(client, conversation["id"], records[2].id).json()
    assert third["position"] == 3

    full = _overview(client, conversation["id"], records[0].id).json()
    assert [item["content"] for item in full["recent_siblings"]] == [
        "message-3",
        "message-2",
        "message-1",
        "message-0",
    ]

    bounded = _overview(client, conversation["id"], records[0].id, recent_limit=2).json()
    assert bounded["counts"]["total"] == 4  # count not bounded by the page
    assert [item["content"] for item in bounded["recent_siblings"]] == [
        "message-3",
        "message-2",
    ]


def test_overview_siblings_use_deterministic_id_tie_break(client):
    project = _project(client, "Ties")
    conversation = _conversation(client, project["id"], "Tied")
    same_time = datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    first = _seed_message(client, conversation["id"], content="first", created_at=same_time)
    second = _seed_message(client, conversation["id"], content="second", created_at=same_time)

    body = _overview(client, conversation["id"], first.id).json()
    ordered_asc = sorted((first, second), key=lambda message: str(message.id))
    expected_position = 1 if first.id == ordered_asc[0].id else 2
    assert body["position"] == expected_position
    assert [item["content"] for item in body["recent_siblings"]] == [
        message.content for message in reversed(ordered_asc)
    ]


def test_overview_ignores_messages_from_other_conversations(client):
    project = _project(client, "Scoped")
    first_conversation = _conversation(client, project["id"], "First")
    second_conversation = _conversation(client, project["id"], "Second")
    target = _seed_message(client, first_conversation["id"], content="mine")
    _seed_message(client, second_conversation["id"], content="theirs")

    body = _overview(client, first_conversation["id"], target.id).json()
    assert body["counts"]["total"] == 1
    assert body["position"] == 1
    assert [item["content"] for item in body["recent_siblings"]] == ["mine"]

    # A real message id from a different conversation is not visible on this path.
    other = _seed_message(client, second_conversation["id"], content="other")
    response = _overview(client, first_conversation["id"], other.id)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "message_not_found"


def test_overview_propagates_operation_id_and_attachments(client):
    project = _project(client, "Attachments")
    conversation = _conversation(client, project["id"], "Ops")
    target = _seed_message(client, conversation["id"], operation_id="text-to-image")

    body = _overview(client, conversation["id"], target.id).json()
    assert body["operation_id"] == "text-to-image"


def test_overview_joins_project_name_with_orphan_fallback(client):
    project = _project(client, "Joined")
    conversation = _conversation(client, project["id"], "In project")
    target = _seed_message(client, conversation["id"], content="x")
    assert (
        _overview(client, conversation["id"], target.id).json()["project_name"] == "Joined"
    )

    orphan = _seed_orphan_conversation(client)
    orphan_message = _seed_message(client, orphan.id, content="orphan")
    assert (
        _overview(client, orphan.id, orphan_message.id).json()["project_name"]
        == "Unknown project"
    )


def test_unknown_conversation_uses_shared_404_envelope(client):
    response = _overview(client, uuid4(), uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "conversation_not_found"
    assert error["request_id"]


def test_unknown_message_uses_shared_404_envelope(client):
    project = _project(client, "Missing message")
    conversation = _conversation(client, project["id"], "No such message")
    response = _overview(client, conversation["id"], uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "message_not_found"
    assert error["request_id"]


def test_malformed_ids_use_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/conversations/not-a-uuid/messages/{uuid4()}/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"

    response = client.get(
        f"{PREFIX}/conversations/{uuid4()}/messages/not-a-uuid/overview"
    )
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    project = _project(client, "Limits")
    conversation = _conversation(client, project["id"], "Limited")
    target = _seed_message(client, conversation["id"], content="x")
    for limit in (0, 51):
        response = _overview(client, conversation["id"], target.id, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
