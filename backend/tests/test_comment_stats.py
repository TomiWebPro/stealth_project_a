"""Authoritative comment statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_REFERENCES = ["asset", "project"]
_KEYS = {
    "total_comments",
    "total_authors",
    "total_projects",
    "by_reference",
    "by_project",
    "by_author",
    "newest_comment_at",
    "generated_at",
}


def _stats(client, **params):
    return client.get(f"{PREFIX}/comments/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Comment Stats Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_comment(client, project_id, author_id, *, asset_id=None, created_at=None):
    """Write a Comment straight to the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.orchestration import Comment
    from app.storage.base import Collections

    comment = Comment(
        id=uuid4(),
        project_id=project_id,
        asset_id=asset_id,
        author_id=author_id,
        body="Seeded comment",
        created_at=created_at or utcnow(),
    )
    client.app.state.store.put(
        Collections.COMMENTS, str(comment.id), comment.model_dump(mode="json")
    )
    return comment


def test_comment_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_comments"] == 0
    assert body["total_authors"] == 0
    assert body["total_projects"] == 0
    assert body["by_reference"] == [{"reference": r, "count": 0} for r in _REFERENCES]
    assert body["by_project"] == []
    assert body["by_author"] == []
    assert body["newest_comment_at"] is None
    assert body["generated_at"]


def test_comment_stats_derives_totals_breakdowns_and_recency(client):
    from app.schemas.common import utcnow

    _clear(client)
    now = utcnow()
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    u1, u2, u3 = uuid4(), uuid4(), uuid4()
    asset_id = uuid4()
    old_comment = _seed_comment(client, p1, u1, created_at=now - timedelta(hours=3))
    _seed_comment(client, p1, u2, asset_id=asset_id, created_at=now - timedelta(hours=2))
    _seed_comment(client, p1, u1, asset_id=asset_id, created_at=now - timedelta(hours=1))
    newest_comment = _seed_comment(client, p2, u3, created_at=now)

    body = _stats(client).json()
    assert body["total_comments"] == 4
    # u1 authored twice, u2 and u3 once each => 3 distinct authors.
    assert body["total_authors"] == 3
    assert body["total_projects"] == 2
    # Two asset-linked comments, two project-level comments.
    assert body["by_reference"] == [
        {"reference": "asset", "count": 2},
        {"reference": "project", "count": 2},
    ]
    # p1 has 3 comments from 2 authors; p2 has 1 comment from 1 author.
    assert body["by_project"] == [
        {"project_id": p1, "comments": 3, "authors": 2},
        {"project_id": p2, "comments": 1, "authors": 1},
    ]
    # u1 (2) > u2 (1) = u3 (1), tie broken by author id.
    expected_author_order = sorted([u2, u3], key=str)
    assert body["by_author"] == [
        {"author_id": str(u1), "comments": 2},
        {"author_id": str(expected_author_order[0]), "comments": 1},
        {"author_id": str(expected_author_order[1]), "comments": 1},
    ]
    assert body["newest_comment_at"] == newest_comment.created_at.isoformat().replace(
        "+00:00", "Z"
    )
    assert old_comment.created_at < newest_comment.created_at


def test_comment_stats_project_scope_unknown_and_malformed(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]
    _seed_comment(client, p1, uuid4(), asset_id=uuid4())
    _seed_comment(client, p2, uuid4())
    _seed_comment(client, p2, uuid4(), asset_id=uuid4())

    scoped = _stats(client, project_id=p1)
    assert scoped.status_code == 200
    body = scoped.json()
    assert body["total_comments"] == 1
    assert body["total_authors"] == 1
    assert body["total_projects"] == 1
    assert body["by_reference"] == [
        {"reference": "asset", "count": 1},
        {"reference": "project", "count": 0},
    ]
    assert body["by_project"] == [{"project_id": p1, "comments": 1, "authors": 1}]
    assert len(body["by_author"]) == 1

    # Unknown-but-well-formed project uses the shared 404 envelope.
    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    # Malformed id uses the shared 422 envelope with a matching request id.
    malformed = _stats(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_comment_stats_by_project_and_author_tie_breaks_are_deterministic(client):
    _clear(client)
    low, high = uuid4(), uuid4()
    if low > high:
        low, high = high, low
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
    # Seed in reverse id order so insertion order cannot drive the result.
    for project_id in (high, low):
        _seed_comment(client, project_id, uuid4())

    body = _stats(client).json()
    assert body["by_project"] == [
        {"project_id": str(low), "comments": 1, "authors": 1},
        {"project_id": str(high), "comments": 1, "authors": 1},
    ]

    # Equal author comment counts are ordered by id, independent of insertion.
    a_high, a_low = uuid4(), uuid4()
    if a_high < a_low:
        a_high, a_low = a_low, a_high
    _clear(client)
    p = _project(client)["id"]
    _seed_comment(client, p, a_high)
    _seed_comment(client, p, a_low)
    body = _stats(client).json()
    assert body["by_author"] == [
        {"author_id": str(a_low), "comments": 1},
        {"author_id": str(a_high), "comments": 1},
    ]


def test_comment_stats_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    _clear(client)
    p = _project(client)["id"]
    assert _stats(client).json()["total_comments"] == 0

    first = _seed_comment(client, p, uuid4(), asset_id=uuid4())
    snapshot = _stats(client).json()
    assert snapshot["total_comments"] == 1
    assert snapshot["by_reference"][0] == {"reference": "asset", "count": 1}

    client.app.state.store.delete(Collections.COMMENTS, str(first.id))
    empty = _stats(client).json()
    assert empty["total_comments"] == 0
    assert empty["total_authors"] == 0
    assert empty["total_projects"] == 0
    assert empty["by_reference"] == [{"reference": r, "count": 0} for r in _REFERENCES]
    assert empty["by_project"] == []
    assert empty["by_author"] == []
    assert empty["newest_comment_at"] is None
