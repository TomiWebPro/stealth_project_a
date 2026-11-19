"""Authoritative conversation statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_ROLES = ["system", "user", "assistant", "tool"]
_STATUSES = ["pending", "streaming", "complete", "error"]
_KEYS = {
    "total_conversations",
    "total_messages",
    "by_role",
    "by_status",
    "average_messages_per_conversation",
    "last_activity_at",
    "generated_at",
}


def _project(client, name="Stats Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_conversation(client, project_id, *, messages=(), updated_at=None):
    """Write a Conversation + its Messages straight to the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.conversation import Conversation, Message
    from app.storage.base import Collections

    now = utcnow()
    conversation = Conversation(
        id=uuid4(),
        project_id=project_id,
        title="Seeded conversation",
        created_by=uuid4(),
        created_at=now - timedelta(hours=2),
        updated_at=updated_at or now,
        message_count=len(messages),
    )
    store = client.app.state.store
    store.put(
        Collections.CONVERSATIONS,
        str(conversation.id),
        conversation.model_dump(mode="json"),
    )
    for spec in messages:
        message = Message(
            id=uuid4(),
            conversation_id=conversation.id,
            role=spec.get("role", "user"),
            content=spec.get("content", "hello"),
            status=spec.get("status", "complete"),
            created_at=now - timedelta(minutes=5),
        )
        store.put(
            Collections.MESSAGES,
            str(message.id),
            message.model_dump(mode="json"),
        )
    return conversation


def _stats(client, **params):
    return client.get(f"{PREFIX}/conversations/stats", params=params)


def test_conversation_stats_empty_store_is_zero_filled(client):
    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_conversations"] == 0
    assert body["total_messages"] == 0
    assert body["by_role"] == [{"role": role, "count": 0} for role in _ROLES]
    assert body["by_status"] == [{"status": status, "count": 0} for status in _STATUSES]
    assert body["average_messages_per_conversation"] == 0.0
    assert body["last_activity_at"] is None
    assert body["generated_at"]


def test_conversation_stats_derives_counts_breakdowns_and_recency(client):
    from app.schemas.common import utcnow

    p1 = _project(client, "Scoped One")["id"]
    p2 = _project(client, "Scoped Two")["id"]
    now = utcnow()

    newest = _seed_conversation(
        client,
        p1,
        messages=[
            {"role": "user", "status": "complete"},
            {"role": "assistant", "status": "complete"},
            {"role": "assistant", "status": "streaming"},
        ],
        updated_at=now,
    )
    _seed_conversation(
        client,
        p1,
        messages=[
            {"role": "system", "status": "complete"},
            {"role": "tool", "status": "error"},
        ],
        updated_at=now - timedelta(hours=1),
    )
    _seed_conversation(
        client,
        p2,
        messages=[{"role": "user", "status": "complete"}],
        updated_at=now - timedelta(days=1),
    )

    body = _stats(client).json()
    assert body["total_conversations"] == 3
    assert body["total_messages"] == 6
    assert body["average_messages_per_conversation"] == 2.0
    assert body["by_role"] == [
        {"role": "system", "count": 1},
        {"role": "user", "count": 2},
        {"role": "assistant", "count": 2},
        {"role": "tool", "count": 1},
    ]
    assert body["by_status"] == [
        {"status": "pending", "count": 0},
        {"status": "streaming", "count": 1},
        {"status": "complete", "count": 4},
        {"status": "error", "count": 1},
    ]
    assert body["last_activity_at"] == newest.updated_at.isoformat().replace("+00:00", "Z")


def test_conversation_stats_project_scope_and_unknown_project_404(client):
    p1 = _project(client, "Scoped One")["id"]
    p2 = _project(client, "Scoped Two")["id"]
    _seed_conversation(
        client,
        p1,
        messages=[
            {"role": "user", "status": "complete"},
            {"role": "assistant", "status": "complete"},
            {"role": "assistant", "status": "complete"},
        ],
    )
    _seed_conversation(
        client,
        p2,
        messages=[
            {"role": "user", "status": "complete"},
            {"role": "tool", "status": "error"},
        ],
    )

    scoped = _stats(client, project_id=p1)
    assert scoped.status_code == 200
    scoped_body = scoped.json()
    assert scoped_body["total_conversations"] == 1
    assert scoped_body["total_messages"] == 3
    assert scoped_body["average_messages_per_conversation"] == 3.0
    assert scoped_body["by_role"][1] == {"role": "user", "count": 1}
    assert scoped_body["by_role"][2] == {"role": "assistant", "count": 2}
    assert scoped_body["by_status"][3] == {"status": "error", "count": 0}

    all_body = _stats(client).json()
    assert all_body["total_conversations"] == 2
    assert all_body["total_messages"] == 5
    assert all_body["by_status"][3] == {"status": "error", "count": 1}

    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    error = missing.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == missing.headers["X-Request-ID"]


def test_conversation_stats_rejects_malformed_project_id(client):
    response = _stats(client, project_id="not-a-uuid")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_conversation_stats_is_derived_live_from_the_store(client):
    project = _project(client)["id"]
    first = _stats(client).json()
    assert first["total_conversations"] == 0

    _seed_conversation(
        client,
        project,
        messages=[{"role": "user", "status": "complete"}],
    )
    second = _stats(client).json()
    assert second["total_conversations"] == 1
    assert second["total_messages"] == 1
    assert second["by_role"][1] == {"role": "user", "count": 1}

    client.app.state.store.clear()
    third = _stats(client).json()
    assert third["total_conversations"] == 0
    assert third["total_messages"] == 0
    assert third["last_activity_at"] is None
