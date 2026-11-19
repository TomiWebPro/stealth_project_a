"""Authoritative comment-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "comment_id",
    "project_id",
    "project_name",
    "asset_id",
    "author_id",
    "body",
    "created_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/comments/feed", params=params)


def _put(client, collection, model):
    client.app.state.store.put(collection, str(model.id), model.model_dump(mode="json"))
    return model


def _project(client, *, name="Feed Project", created_at=None):
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = created_at or utcnow()
    return _put(
        client,
        Collections.PROJECTS,
        Project(
            id=uuid4(),
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

    return _put(
        client,
        Collections.COMMENTS,
        Comment(
            id=uuid4(),
            project_id=project_id,
            asset_id=asset_id,
            author_id=uuid4(),
            body=body,
            created_at=created_at or utcnow(),
        ),
    )


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["comment_id"]),
        reverse=True,
    )


def test_comment_feed_empty_store_is_zero_filled(client):
    client.app.state.store.clear()

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_comment_feed_is_newest_first_with_project_join_and_fields(client):
    from app.schemas.common import utcnow

    client.app.state.store.clear()
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")
    now = utcnow()
    asset_id = uuid4()

    c1 = _comment(client, alpha.id, body="oldest", created_at=now - timedelta(hours=2))
    c2 = _comment(client, alpha.id, body="newest", asset_id=asset_id, created_at=now)
    c3 = _comment(client, beta.id, body="middle", created_at=now - timedelta(hours=1))

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)
    assert [item["comment_id"] for item in items] == [str(c2.id), str(c3.id), str(c1.id)]

    by_id = {item["comment_id"]: item for item in items}
    assert set(by_id) == {str(c1.id), str(c2.id), str(c3.id)}
    assert set(by_id[str(c1.id)]) == _ITEM_KEYS

    first = by_id[str(c1.id)]
    assert first["project_id"] == str(alpha.id)
    assert first["project_name"] == "Alpha Project"
    assert first["body"] == "oldest"
    assert first["asset_id"] is None
    assert first["author_id"]
    assert first["created_at"]

    assert by_id[str(c3.id)]["project_name"] == "Beta Project"
    assert by_id[str(c2.id)]["asset_id"] == str(asset_id)


def test_comment_feed_uses_fallback_for_orphan_comment(client):
    client.app.state.store.clear()
    unknown_project = uuid4()  # no Project document for this id
    comment = _comment(client, unknown_project)

    body = _feed(client).json()
    assert body["total"] == 1
    assert body["items"][0]["comment_id"] == str(comment.id)
    assert body["items"][0]["project_name"] == "Unknown project"


def test_comment_feed_project_scope_narrows_derivation(client):
    client.app.state.store.clear()
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")
    a_comment = _comment(client, alpha.id)
    _comment(client, beta.id)

    scoped = _feed(client, project_id=alpha.id).json()
    assert scoped["total"] == 1
    assert [item["comment_id"] for item in scoped["items"]] == [str(a_comment.id)]
    assert scoped["items"][0]["project_name"] == "Alpha Project"

    assert _feed(client).json()["total"] == 2
    assert _feed(client, project_id=beta.id).json()["total"] == 1


def test_comment_feed_unknown_project_uses_shared_404_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_comment_feed_limit_bounds_page_but_not_total(client):
    client.app.state.store.clear()
    project = _project(client)
    for index in range(4):
        _comment(client, project.id, body=f"comment {index}")

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_comment_feed_total_agrees_with_comments_list(client):
    client.app.state.store.clear()
    alpha = _project(client)
    beta = _project(client)
    _comment(client, alpha.id)
    _comment(client, alpha.id)
    _comment(client, beta.id)

    feed = _feed(client).json()
    alpha_comments = client.get(f"{PREFIX}/comments", params={"project_id": alpha.id}).json()
    beta_comments = client.get(f"{PREFIX}/comments", params={"project_id": beta.id}).json()
    assert feed["total"] == len(alpha_comments) + len(beta_comments) == 3


def test_comment_feed_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    client.app.state.store.clear()
    project = _project(client)
    assert _feed(client).json()["total"] == 0

    seeded = _comment(client, project.id, body="Text-to-image feedback")
    second = _feed(client).json()
    assert second["total"] == 1
    assert second["items"][0]["comment_id"] == str(seeded.id)
    assert second["items"][0]["body"] == "Text-to-image feedback"

    # Removing the comment from the authoritative store removes it from the feed.
    client.app.state.store.delete(Collections.COMMENTS, str(seeded.id))
    assert _feed(client).json()["total"] == 0


def test_comment_feed_malformed_project_id_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_comment_feed_invalid_limit_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
