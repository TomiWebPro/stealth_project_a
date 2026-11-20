"""Authoritative single-comment overview endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "comment_id",
    "project_id",
    "project_name",
    "asset_id",
    "author_id",
    "body",
    "created_at",
    "reference",
    "counts",
    "recent_comments",
    "generated_at",
}
_COUNT_KEYS = {"project_comments", "project_authors", "project_assets", "thread_comments"}
_ITEM_KEYS = {
    "comment_id",
    "project_id",
    "project_name",
    "asset_id",
    "author_id",
    "body",
    "created_at",
}


def _overview(client, comment_id, **params):
    return client.get(f"{PREFIX}/comments/{comment_id}/overview", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Comment Overview Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_comment(client, project_id, author_id, *, asset_id=None, body="Seeded", created_at=None):
    """Write a Comment straight to the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.orchestration import Comment
    from app.storage.base import Collections

    comment = Comment(
        id=uuid4(),
        project_id=project_id,
        asset_id=asset_id,
        author_id=author_id,
        body=body,
        created_at=created_at or utcnow(),
    )
    client.app.state.store.put(
        Collections.COMMENTS, str(comment.id), comment.model_dump(mode="json")
    )
    return comment


def test_overview_of_project_level_comment(client):
    _clear(client)
    project = _project(client, "Threads")
    comment = _seed_comment(client, project["id"], uuid4(), body="Project note")

    response = _overview(client, comment.id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["comment_id"] == str(comment.id)
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Threads"
    assert body["asset_id"] is None
    assert body["author_id"] == str(comment.author_id)
    assert body["body"] == "Project note"
    assert body["created_at"]
    assert body["reference"] == "project"
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {
        "project_comments": 1,
        "project_authors": 1,
        "project_assets": 0,
        "thread_comments": 1,
    }
    assert len(body["recent_comments"]) == 1
    assert set(body["recent_comments"][0]) == _ITEM_KEYS
    assert body["recent_comments"][0]["comment_id"] == str(comment.id)
    assert body["generated_at"]


def test_overview_of_asset_scoped_comment_counts_and_thread(client):
    _clear(client)
    from app.schemas.common import utcnow

    now = utcnow()
    project = _project(client, "Scoped")["id"]

    u1, u2, u3 = uuid4(), uuid4(), uuid4()
    asset_a, asset_b = uuid4(), uuid4()
    old = _seed_comment(
        client, project, u1, asset_id=asset_a, body="on A old",
        created_at=now - timedelta(hours=3),
    )
    other_asset = _seed_comment(
        client, project, u2, asset_id=asset_b, body="on B",
        created_at=now - timedelta(hours=2),
    )
    project_level = _seed_comment(
        client, project, u3, body="project level",
        created_at=now - timedelta(hours=1),
    )
    newest = _seed_comment(
        client, project, u2, asset_id=asset_a, body="on A newest",
        created_at=now,
    )

    body = _overview(client, newest.id).json()
    assert body["reference"] == "asset"
    assert body["asset_id"] == str(asset_a)
    assert body["counts"] == {
        "project_comments": 4,
        "project_authors": 3,
        "project_assets": 2,
        "thread_comments": 2,  # only the two comments on asset_a
    }
    assert [item["comment_id"] for item in body["recent_comments"]] == [
        str(newest.id),
        str(old.id),
    ]

    # The project-level comment sees only its own (asset_id=None) thread.
    project_view = _overview(client, project_level.id).json()
    assert project_view["reference"] == "project"
    assert project_view["counts"]["thread_comments"] == 1
    assert [item["comment_id"] for item in project_view["recent_comments"]] == [
        str(project_level.id)
    ]

    # The other-asset comment sees only its own single-comment thread.
    other_view = _overview(client, other_asset.id).json()
    assert other_view["counts"]["thread_comments"] == 1
    assert [item["comment_id"] for item in other_view["recent_comments"]] == [
        str(other_asset.id)
    ]


def test_counts_never_bounded_by_recent_limit(client):
    _clear(client)
    from app.schemas.common import utcnow

    now = utcnow()
    project = _project(client, "Paged")["id"]
    asset_id = uuid4()
    comments = [
        _seed_comment(
            client, project, uuid4(), asset_id=asset_id,
            body=f"c{i}", created_at=now + timedelta(seconds=i),
        )
        for i in range(4)
    ]

    full = _overview(client, comments[0].id).json()
    assert full["counts"]["project_comments"] == 4
    assert full["counts"]["thread_comments"] == 4
    assert [item["comment_id"] for item in full["recent_comments"]] == [
        str(comment.id) for comment in reversed(comments)
    ]

    bounded = _overview(client, comments[0].id, recent_limit=2).json()
    assert bounded["counts"] == full["counts"]
    assert [item["comment_id"] for item in bounded["recent_comments"]] == [
        str(comment.id) for comment in list(reversed(comments))[:2]
    ]


def test_orphan_project_uses_unknown_fallback(client):
    _clear(client)
    comment = _seed_comment(client, uuid4(), uuid4(), body="Orphan")
    view = _overview(client, comment.id).json()
    assert view["project_name"] == "Unknown project"
    assert view["recent_comments"][0]["project_name"] == "Unknown project"


def test_unknown_comment_uses_shared_404_envelope(client):
    _clear(client)
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "comment_not_found"
    assert error["request_id"]


def test_malformed_comment_id_uses_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/comments/not-a-uuid/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    _clear(client)
    comment = _seed_comment(client, _project(client, "Limits")["id"], uuid4())
    for limit in (0, 51):
        response = _overview(client, comment.id, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
