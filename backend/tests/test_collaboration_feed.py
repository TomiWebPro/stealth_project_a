"""Authoritative collaboration-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "signal_id",
    "signal",
    "project_id",
    "project_name",
    "actor_id",
    "state",
    "body",
    "asset_id",
    "occurred_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/collaboration/feed", params=params)


def _put(client, collection, key, model):
    client.app.state.store.put(collection, key, model.model_dump(mode="json"))
    return model


def _project(client, *, name="Feed Project"):
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    project_id = uuid4()
    return _put(
        client,
        Collections.PROJECTS,
        str(project_id),
        Project(
            id=project_id,
            org_id=uuid4(),
            name=name,
            created_by=uuid4(),
            created_at=now,
            updated_at=now,
        ),
    )


def _comment(client, project_id, *, body="A comment", asset_id=None, created_at=None):
    from app.schemas.common import utcnow
    from app.schemas.orchestration import Comment
    from app.storage.base import Collections

    comment = Comment(
        id=uuid4(),
        project_id=project_id,
        asset_id=asset_id,
        author_id=uuid4(),
        body=body,
        created_at=created_at or utcnow(),
    )
    return _put(client, Collections.COMMENTS, str(comment.id), comment)


def _presence(client, project_id, *, user_id=None, state="online", last_seen_at=None):
    from app.schemas.common import utcnow
    from app.schemas.orchestration import Presence
    from app.storage.base import Collections

    user_id = user_id or uuid4()
    presence = Presence(
        user_id=user_id,
        project_id=project_id,
        state=state,
        last_seen_at=last_seen_at or utcnow(),
    )
    return _put(
        client,
        Collections.PRESENCE,
        f"{project_id}:{user_id}",
        presence,
    )


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (
            item["occurred_at"],
            item["signal_id"],
            item["signal"],
            item["project_id"],
        ),
        reverse=True,
    )


def test_collaboration_feed_empty_store_is_zero_filled(client):
    client.app.state.store.clear()

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_collaboration_feed_is_newest_first_with_mixed_signals_and_fields(client):
    from app.schemas.common import utcnow

    client.app.state.store.clear()
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")
    now = utcnow()
    asset_id = uuid4()

    oldest_comment = _comment(client, alpha.id, body="oldest", created_at=now - timedelta(hours=3))
    newest_presence = _presence(
        client, beta.id, state="online", last_seen_at=now
    )
    middle_comment = _comment(
        client,
        alpha.id,
        body="middle",
        asset_id=asset_id,
        created_at=now - timedelta(hours=1),
    )
    old_presence = _presence(
        client, alpha.id, state="away", last_seen_at=now - timedelta(hours=2)
    )

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 4
    items = body["items"]
    assert len(items) == 4
    assert _sorted_desc(items)

    by_signal = {(item["signal"], item["signal_id"]): item for item in items}
    assert set(by_signal) == {
        ("comment", str(oldest_comment.id)),
        ("comment", str(middle_comment.id)),
        ("presence", str(newest_presence.user_id)),
        ("presence", str(old_presence.user_id)),
    }
    assert all(set(item) == _ITEM_KEYS for item in items)

    comment_item = by_signal[("comment", str(middle_comment.id))]
    assert comment_item["project_id"] == str(alpha.id)
    assert comment_item["project_name"] == "Alpha Project"
    assert comment_item["actor_id"] == str(middle_comment.author_id)
    assert comment_item["signal"] == "comment"
    assert comment_item["body"] == "middle"
    assert comment_item["asset_id"] == str(asset_id)
    assert comment_item["state"] is None
    assert comment_item["occurred_at"]

    presence_item = by_signal[("presence", str(old_presence.user_id))]
    assert presence_item["project_id"] == str(alpha.id)
    assert presence_item["project_name"] == "Alpha Project"
    assert presence_item["actor_id"] == str(old_presence.user_id)
    assert presence_item["signal"] == "presence"
    assert presence_item["state"] == "away"
    assert presence_item["body"] is None
    assert presence_item["asset_id"] is None
    assert presence_item["occurred_at"]


def test_collaboration_feed_signal_filter(client):
    client.app.state.store.clear()
    project = _project(client)
    _presence(client, project.id)
    _comment(client, project.id)

    presence_only = _feed(client, signal="presence").json()
    assert presence_only["total"] == 1
    assert presence_only["items"][0]["signal"] == "presence"

    comments_only = _feed(client, signal="comment").json()
    assert comments_only["total"] == 1
    assert comments_only["items"][0]["signal"] == "comment"

    assert _feed(client).json()["total"] == 2


def test_collaboration_feed_project_scope_narrows_derivation(client):
    client.app.state.store.clear()
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")
    a_presence = _presence(client, alpha.id)
    _comment(client, beta.id)

    scoped = _feed(client, project_id=alpha.id).json()
    assert scoped["total"] == 1
    assert scoped["items"][0]["signal_id"] == str(a_presence.user_id)
    assert scoped["items"][0]["project_name"] == "Alpha Project"

    assert _feed(client).json()["total"] == 2
    assert _feed(client, project_id=beta.id).json()["total"] == 1


def test_collaboration_feed_uses_fallback_for_orphan_signal(client):
    client.app.state.store.clear()
    unknown_project = uuid4()  # no Project document for this id
    presence = _presence(client, unknown_project)
    comment = _comment(client, unknown_project)

    body = _feed(client).json()
    assert body["total"] == 2
    assert {item["project_name"] for item in body["items"]} == {"Unknown project"}
    assert {item["signal_id"] for item in body["items"]} == {
        str(presence.user_id),
        str(comment.id),
    }


def test_collaboration_feed_unknown_project_uses_shared_404_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_collaboration_feed_limit_bounds_page_but_not_total(client):
    client.app.state.store.clear()
    project = _project(client)
    for index in range(5):
        _comment(client, project.id, body=f"comment {index}")
    _presence(client, project.id)

    body = _feed(client, limit=2).json()
    assert body["total"] == 6
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_collaboration_feed_total_agrees_with_collaboration_stats(client):
    client.app.state.store.clear()
    alpha = _project(client)
    beta = _project(client)
    _presence(client, alpha.id)
    _presence(client, alpha.id, user_id=uuid4())
    _comment(client, alpha.id)
    _comment(client, beta.id)

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/collaboration/stats").json()
    assert feed["total"] == stats["total_presence"] + stats["total_comments"] == 4


def test_collaboration_feed_is_derived_live_from_the_store(client):
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    client.app.state.store.clear()
    project = _project(client)
    assert _feed(client).json()["total"] == 0

    seeded = _comment(client, project.id, body="Text-to-image feedback", created_at=utcnow())
    second = _feed(client).json()
    assert second["total"] == 1
    assert second["items"][0]["signal_id"] == str(seeded.id)
    assert second["items"][0]["body"] == "Text-to-image feedback"

    # Removing the signal from the authoritative store removes it from the feed.
    client.app.state.store.delete(Collections.COMMENTS, str(seeded.id))
    assert _feed(client).json()["total"] == 0


def test_collaboration_feed_malformed_project_id_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]


def test_collaboration_feed_invalid_limit_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


def test_collaboration_feed_invalid_signal_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, signal="not-a-signal")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]
