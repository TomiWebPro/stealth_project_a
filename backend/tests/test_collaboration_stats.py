"""Authoritative collaboration statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_STATES = ["online", "away", "offline"]
_KEYS = {
    "total_presence",
    "total_comments",
    "total_participants",
    "by_state",
    "by_project",
    "newest_presence_at",
    "newest_comment_at",
    "generated_at",
}


def _stats(client, **params):
    return client.get(f"{PREFIX}/collaboration/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Collaboration Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_presence(client, project_id, user_id, state, *, last_seen_at=None):
    """Write a Presence straight to the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.orchestration import Presence
    from app.storage.base import Collections

    presence = Presence(
        user_id=user_id,
        project_id=project_id,
        state=state,
        last_seen_at=last_seen_at or utcnow(),
    )
    client.app.state.store.put(
        Collections.PRESENCE,
        f"{project_id}:{user_id}",
        presence.model_dump(mode="json"),
    )
    return presence


def _seed_comment(client, project_id, author_id, *, created_at=None):
    """Write a Comment straight to the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.orchestration import Comment
    from app.storage.base import Collections

    comment = Comment(
        id=uuid4(),
        project_id=project_id,
        author_id=author_id,
        body="Seeded comment",
        created_at=created_at or utcnow(),
    )
    client.app.state.store.put(
        Collections.COMMENTS, str(comment.id), comment.model_dump(mode="json")
    )
    return comment


def test_collaboration_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_presence"] == 0
    assert body["total_comments"] == 0
    assert body["total_participants"] == 0
    assert body["by_state"] == [{"state": s, "count": 0} for s in _STATES]
    assert body["by_project"] == []
    assert body["newest_presence_at"] is None
    assert body["newest_comment_at"] is None
    assert body["generated_at"]


def test_collaboration_stats_derives_totals_breakdowns_and_recency(client):
    from app.schemas.common import utcnow

    _clear(client)
    now = utcnow()
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    u1, u2, u3, u4 = (uuid4() for _ in range(4))
    old_presence = _seed_presence(client, p1, u1, "online", last_seen_at=now - timedelta(hours=3))
    _seed_presence(client, p1, u2, "online", last_seen_at=now - timedelta(hours=2))
    _seed_presence(client, p1, u3, "away", last_seen_at=now - timedelta(hours=1))
    newest_presence = _seed_presence(client, p2, u4, "offline", last_seen_at=now)

    old_comment = _seed_comment(client, p1, u1, created_at=now - timedelta(hours=3))
    _seed_comment(client, p1, u2, created_at=now - timedelta(hours=2))
    newest_comment = _seed_comment(client, p2, u4, created_at=now)

    body = _stats(client).json()
    assert body["total_presence"] == 4
    assert body["total_comments"] == 3
    # u1, u2, u3, u4 all participate via presence and/or comments.
    assert body["total_participants"] == 4
    assert body["by_state"] == [
        {"state": "online", "count": 2},
        {"state": "away", "count": 1},
        {"state": "offline", "count": 1},
    ]
    # p1 has 2 comments + 3 presence, p2 has 1 comment + 1 presence.
    assert body["by_project"] == [
        {"project_id": p1, "comments": 2, "presence": 3},
        {"project_id": p2, "comments": 1, "presence": 1},
    ]
    assert body["newest_presence_at"] == newest_presence.last_seen_at.isoformat().replace(
        "+00:00", "Z"
    )
    assert body["newest_comment_at"] == newest_comment.created_at.isoformat().replace(
        "+00:00", "Z"
    )
    assert old_presence.last_seen_at < newest_presence.last_seen_at
    assert old_comment.created_at < newest_comment.created_at


def test_collaboration_stats_project_scope_unknown_and_malformed(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]
    _seed_presence(client, p1, uuid4(), "online")
    _seed_comment(client, p1, uuid4())
    _seed_presence(client, p2, uuid4(), "away")
    _seed_comment(client, p2, uuid4())
    _seed_comment(client, p2, uuid4())

    scoped = _stats(client, project_id=p1)
    assert scoped.status_code == 200
    body = scoped.json()
    assert body["total_presence"] == 1
    assert body["total_comments"] == 1
    assert body["total_participants"] == 2
    assert body["by_state"] == [
        {"state": "online", "count": 1},
        {"state": "away", "count": 0},
        {"state": "offline", "count": 0},
    ]
    assert body["by_project"] == [{"project_id": p1, "comments": 1, "presence": 1}]

    # Unknown-but-well-formed project uses the shared 404 envelope.
    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _stats(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_collaboration_stats_counts_distinct_participants(client):
    _clear(client)
    p = _project(client)["id"]
    u1, u2 = uuid4(), uuid4()
    # u1 is both present and an author; u2 only authors, u3 only present.
    u3 = uuid4()
    _seed_presence(client, p, u1, "online")
    _seed_presence(client, p, u3, "online")
    _seed_comment(client, p, u1)
    _seed_comment(client, p, u2)

    body = _stats(client).json()
    assert body["total_presence"] == 2
    assert body["total_comments"] == 2
    assert body["total_participants"] == 3


def test_collaboration_stats_by_project_tie_break_is_deterministic(client):
    _clear(client)
    low, high = uuid4(), uuid4()
    if low > high:
        low, high = high, low
    # Seed projects directly with fixed ids so both have identical activity.
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    for project_id in (low, high):
        client.app.state.store.put(
            Collections.PROJECTS,
            str(project_id),
            Project(
                id=project_id,
                org_id=uuid4(),
                name="P",
                created_by=uuid4(),
                created_at=now,
                updated_at=now,
            ).model_dump(mode="json"),
        )
    for project_id in (high, low):
        _seed_presence(client, project_id, uuid4(), "online")
        _seed_comment(client, project_id, uuid4())

    body = _stats(client).json()
    assert body["by_project"] == [
        {"project_id": str(low), "comments": 1, "presence": 1},
        {"project_id": str(high), "comments": 1, "presence": 1},
    ]


def test_collaboration_stats_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    _clear(client)
    p = _project(client)["id"]
    assert _stats(client).json()["total_presence"] == 0

    presence = _seed_presence(client, p, uuid4(), "online")
    comment = _seed_comment(client, p, uuid4())
    first = _stats(client).json()
    assert first["total_presence"] == 1
    assert first["total_comments"] == 1
    assert first["by_state"][0] == {"state": "online", "count": 1}

    client.app.state.store.delete(Collections.PRESENCE, f"{p}:{presence.user_id}")
    client.app.state.store.delete(Collections.COMMENTS, str(comment.id))
    second = _stats(client).json()
    assert second["total_presence"] == 0
    assert second["total_comments"] == 0
    assert second["total_participants"] == 0
    assert second["by_state"] == [{"state": s, "count": 0} for s in _STATES]
    assert second["by_project"] == []
    assert second["newest_presence_at"] is None
    assert second["newest_comment_at"] is None
