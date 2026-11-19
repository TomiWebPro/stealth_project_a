"""Authoritative search index statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.schemas.common import utcnow

from .conftest import PREFIX

_KINDS = ["project", "asset", "conversation"]
_KEYS = {
    "total_documents",
    "by_kind",
    "newest_document_at",
    "generated_at",
}


def _stats(client, **params):
    return client.get(f"{PREFIX}/search/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Search Stats Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _asset(client, project_id, name="Hero", **extra):
    payload = {
        "project_id": project_id,
        "type": "image",
        "name": name,
        "storage": {
            "backend": "local",
            "key": f"Output/{name}.png",
            "size_bytes": 0,
            "content_type": "image/png",
        },
        **extra,
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201
    return response.json()


def _seed_conversation(client, project_id, *, updated_at=None):
    """Write a Conversation straight to the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.conversation import Conversation
    from app.storage.base import Collections

    now = utcnow()
    conversation = Conversation(
        id=uuid4(),
        project_id=project_id,
        title="Seeded conversation",
        created_by=uuid4(),
        created_at=now - timedelta(hours=2),
        updated_at=updated_at or now,
    )
    client.app.state.store.put(
        Collections.CONVERSATIONS,
        str(conversation.id),
        conversation.model_dump(mode="json"),
    )
    return conversation


def test_search_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_documents"] == 0
    assert body["by_kind"] == [{"kind": kind, "count": 0} for kind in _KINDS]
    assert body["newest_document_at"] is None
    assert body["generated_at"]


def test_search_stats_derives_counts_by_kind_and_recency(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    # Three assets, one of which is soft-deleted (excluded like /search).
    a1 = _asset(client, p1, "A1")
    _asset(client, p1, "A2")
    _asset(client, p2, "A3")
    assert client.delete(f"{PREFIX}/assets/{a1['id']}").status_code == 204

    # Two conversations, one with a deliberately newest timestamp.
    future = utcnow() + timedelta(days=1)
    seeded = _seed_conversation(client, p1, updated_at=future)
    _seed_conversation(client, p2)

    body = _stats(client).json()
    assert body["total_documents"] == 6  # 2 projects + 2 live assets + 2 convos
    assert body["by_kind"] == [
        {"kind": "project", "count": 2},
        {"kind": "asset", "count": 2},
        {"kind": "conversation", "count": 2},
    ]
    # Recency matches the newest searchable document's serialized timestamp.
    assert body["newest_document_at"] == seeded.model_dump(mode="json")["updated_at"]


def test_search_stats_project_scope_counts_only_scoped_documents(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    _asset(client, p1, "A1")
    _asset(client, p1, "A2")
    _asset(client, p2, "B1")
    _seed_conversation(client, p1)
    _seed_conversation(client, p2)
    _seed_conversation(client, p2)

    body = _stats(client, project_id=p1).json()
    # The scoped project is itself one searchable project document.
    assert body["by_kind"] == [
        {"kind": "project", "count": 1},
        {"kind": "asset", "count": 2},
        {"kind": "conversation", "count": 1},
    ]
    assert body["total_documents"] == 4

    # Workspace-wide stats still count everything.
    global_body = _stats(client).json()
    assert global_body["total_documents"] == 8  # 2 + 3 + 3


def test_search_stats_project_scope_unknown_and_malformed(client):
    _clear(client)

    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _stats(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_search_stats_is_derived_live_from_the_store(client):
    _clear(client)
    p = _project(client)["id"]
    before = _stats(client).json()
    assert before["by_kind"] == [{"kind": "project", "count": 1}, {"kind": "asset", "count": 0}, {"kind": "conversation", "count": 0}]

    asset = _asset(client, p, "New")
    after_create = _stats(client).json()
    assert after_create["by_kind"][1] == {"kind": "asset", "count": 1}
    assert after_create["total_documents"] == 2

    from app.storage.base import Collections

    client.app.state.store.delete(Collections.ASSETS, asset["id"])
    after_delete = _stats(client).json()
    assert after_delete["by_kind"][1] == {"kind": "asset", "count": 0}
    assert after_delete["total_documents"] == 1
