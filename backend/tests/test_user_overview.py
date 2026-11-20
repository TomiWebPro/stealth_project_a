"""Authoritative single-user overview tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.schemas.auth import Member, Organization, Project, User
from app.schemas.common import utcnow
from app.schemas.conversation import Conversation
from app.schemas.orchestration import Comment, Presence
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "user_id",
    "email",
    "display_name",
    "avatar_url",
    "created_at",
    "counts",
    "memberships",
    "recent_projects",
    "recent_comments",
    "generated_at",
}
_COUNT_KEYS = {"organizations", "projects", "conversations", "comments", "presence"}
_MEMBER_KEYS = {"org_id", "org_name", "role", "joined_at"}


def _overview(client, user_id, **params):
    return client.get(f"{PREFIX}/users/{user_id}/overview", params=params)


def _clear(client):
    client.app.state.store.clear()


def _put(client, collection, doc_id, model):
    client.app.state.store.put(collection, doc_id, model.model_dump(mode="json"))


def _user(client, name="Ada", *, age_seconds=0):
    now = utcnow() - timedelta(seconds=age_seconds)
    user = User(
        id=uuid4(),
        email=f"{name.lower()}@studio.local",
        display_name=name,
        avatar_url=None,
        created_at=now,
    )
    _put(client, Collections.USERS, str(user.id), user)
    return user


def _org(client, name):
    org = Organization(id=uuid4(), name=name, slug=name.lower(), created_at=utcnow())
    _put(client, Collections.ORGANIZATIONS, str(org.id), org)
    return org


def _membership(client, org_id, user, role="member", *, age_seconds=0):
    member = Member(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=role,
        joined_at=utcnow() - timedelta(seconds=age_seconds),
    )
    document = member.model_dump(mode="json")
    document["_org_id"] = str(org_id)
    client.app.state.store.put(
        Collections.MEMBERS, f"{org_id}:{user.id}", document
    )
    return member


def _project(client, user, name, *, age_seconds=0):
    now = utcnow() - timedelta(seconds=age_seconds)
    project = Project(
        id=uuid4(),
        org_id=uuid4(),
        name=name,
        created_by=user.id,
        created_at=now,
        updated_at=now,
    )
    _put(client, Collections.PROJECTS, str(project.id), project)
    return project


def _conversation(client, user, *, age_seconds=0):
    now = utcnow() - timedelta(seconds=age_seconds)
    conversation = Conversation(
        id=uuid4(),
        project_id=uuid4(),
        title=f"Chat {age_seconds}",
        created_by=user.id,
        created_at=now,
        updated_at=now,
    )
    _put(client, Collections.CONVERSATIONS, str(conversation.id), conversation)
    return conversation


def _comment(client, user, *, age_seconds=0):
    comment = Comment(
        id=uuid4(),
        project_id=uuid4(),
        author_id=user.id,
        body="Nice work",
        created_at=utcnow() - timedelta(seconds=age_seconds),
    )
    _put(client, Collections.COMMENTS, str(comment.id), comment)
    return comment


def _presence(client, user, *, age_seconds=0):
    signal = Presence(
        user_id=user.id,
        project_id=uuid4(),
        state="online",
        last_seen_at=utcnow() - timedelta(seconds=age_seconds),
    )
    client.app.state.store.put(
        Collections.PRESENCE, f"{user.id}:{signal.project_id}", signal.model_dump(mode="json")
    )
    return signal


def test_overview_of_user_with_no_activity(client):
    _clear(client)
    user = _user(client, "Empty")

    response = _overview(client, user.id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["user_id"] == str(user.id)
    assert body["email"] == "empty@studio.local"
    assert body["display_name"] == "Empty"
    assert body["avatar_url"] is None
    assert body["created_at"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {
        "organizations": 0,
        "projects": 0,
        "conversations": 0,
        "comments": 0,
        "presence": 0,
    }
    assert body["memberships"] == []
    assert body["recent_projects"] == []
    assert body["recent_comments"] == []
    assert body["generated_at"]


def test_memberships_join_org_names_roles_and_skip_bad_records(client):
    _clear(client)
    user = _user(client, "Member")
    org_a = _org(client, "Alpha")
    org_b = _org(client, "Beta")
    org_c = _org(client, "Gamma")

    _membership(client, org_a.id, user, "owner", age_seconds=100)
    _membership(client, org_b.id, user, "viewer", age_seconds=1)
    _membership(client, org_c.id, user, "member", age_seconds=50)
    # A membership to an unknown org keeps the link with a stable fallback name.
    orphan_org_id = uuid4()
    _membership(client, orphan_org_id, user, "member", age_seconds=25)
    # A malformed membership document (no `_org_id`) must be skipped entirely.
    bad = Member(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        role="admin",
        joined_at=utcnow(),
    )
    client.app.state.store.put(
        Collections.MEMBERS, f"bad:{user.id}", bad.model_dump(mode="json")
    )

    body = _overview(client, user.id).json()
    assert body["counts"]["organizations"] == 4
    assert set(body["memberships"][0]) == _MEMBER_KEYS
    assert [m["org_id"] for m in body["memberships"]] == [
        str(org_b.id),
        str(orphan_org_id),
        str(org_c.id),
        str(org_a.id),
    ]
    assert [m["role"] for m in body["memberships"]] == [
        "viewer",
        "member",
        "member",
        "owner",
    ]
    names = {m["org_id"]: m["org_name"] for m in body["memberships"]}
    assert names[str(org_a.id)] == "Alpha"
    assert names[str(orphan_org_id)] == "Unknown organization"


def test_counts_never_bounded_by_recent_limit_and_pages_newest_first(client):
    _clear(client)
    user = _user(client, "Busy")
    projects = [_project(client, user, f"P{i}", age_seconds=i) for i in range(4)]
    comments = [_comment(client, user, age_seconds=i) for i in range(4)]
    for i in range(2):
        _conversation(client, user, age_seconds=i)
    for i in range(2):
        _presence(client, user, age_seconds=i)

    full = _overview(client, user.id, recent_limit=50).json()
    assert full["counts"] == {
        "organizations": 0,
        "projects": 4,
        "conversations": 2,
        "comments": 4,
        "presence": 2,
    }
    assert [p["id"] for p in full["recent_projects"]] == [
        str(p.id) for p in projects
    ]
    assert [c["id"] for c in full["recent_comments"]] == [
        str(c.id) for c in comments
    ]

    bounded = _overview(client, user.id, recent_limit=2).json()
    assert bounded["counts"] == full["counts"]
    assert [p["id"] for p in bounded["recent_projects"]] == [
        str(p.id) for p in projects[:2]
    ]
    assert [c["id"] for c in bounded["recent_comments"]] == [
        str(c.id) for c in comments[:2]
    ]


def test_other_users_activity_is_excluded(client):
    _clear(client)
    user = _user(client, "Owner")
    other = _user(client, "Other")
    mine = _project(client, user, "Mine")
    _project(client, other, "Theirs")
    _comment(client, user)
    _comment(client, other)

    body = _overview(client, user.id).json()
    assert body["counts"]["projects"] == 1
    assert body["counts"]["comments"] == 1
    assert [p["id"] for p in body["recent_projects"]] == [str(mine.id)]


def test_unknown_user_uses_shared_404_envelope(client):
    _clear(client)
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "user_not_found"
    assert error["request_id"]


def test_malformed_user_id_uses_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/users/not-a-uuid/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    _clear(client)
    user = _user(client, "Limits")
    for limit in (0, 51):
        response = _overview(client, user.id, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
