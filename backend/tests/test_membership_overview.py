"""Authoritative single-membership overview tests (success + failure paths)."""

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
    "org_id",
    "org_name",
    "org_slug",
    "user_id",
    "email",
    "display_name",
    "avatar_url",
    "role",
    "joined_at",
    "counts",
    "recent_projects",
    "recent_comments",
    "generated_at",
}
_COUNT_KEYS = {"projects", "conversations", "comments", "presence"}


def _overview(client, org_id, user_id, **params):
    return client.get(f"{PREFIX}/orgs/{org_id}/members/{user_id}/overview", params=params)


def _clear(client):
    client.app.state.store.clear()


def _put(client, collection, doc_id, model):
    client.app.state.store.put(collection, doc_id, model.model_dump(mode="json"))


def _user(client, name="Ada", *, age_seconds=0):
    user = User(
        id=uuid4(),
        email=f"{name.lower()}@studio.local",
        display_name=name,
        avatar_url=None,
        created_at=utcnow() - timedelta(seconds=age_seconds),
    )
    _put(client, Collections.USERS, str(user.id), user)
    return user


def _org(client, name):
    org = Organization(
        id=uuid4(), name=name, slug=name.lower(), created_at=utcnow()
    )
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


def _project(client, org_id, user, name, *, age_seconds=0, created_by=None):
    now = utcnow() - timedelta(seconds=age_seconds)
    project = Project(
        id=uuid4(),
        org_id=org_id,
        name=name,
        created_by=created_by or user.id,
        created_at=now,
        updated_at=now,
    )
    _put(client, Collections.PROJECTS, str(project.id), project)
    return project


def _conversation(client, project_id, user, *, age_seconds=0):
    now = utcnow() - timedelta(seconds=age_seconds)
    conversation = Conversation(
        id=uuid4(),
        project_id=project_id,
        title=f"Chat {age_seconds}",
        created_by=user.id,
        created_at=now,
        updated_at=now,
    )
    _put(client, Collections.CONVERSATIONS, str(conversation.id), conversation)
    return conversation


def _comment(client, project_id, user, *, age_seconds=0):
    comment = Comment(
        id=uuid4(),
        project_id=project_id,
        author_id=user.id,
        body="Nice work",
        created_at=utcnow() - timedelta(seconds=age_seconds),
    )
    _put(client, Collections.COMMENTS, str(comment.id), comment)
    return comment


def _presence(client, project_id, user, *, age_seconds=0):
    signal = Presence(
        user_id=user.id,
        project_id=project_id,
        state="online",
        last_seen_at=utcnow() - timedelta(seconds=age_seconds),
    )
    client.app.state.store.put(
        Collections.PRESENCE,
        f"{user.id}:{project_id}:{age_seconds}",
        signal.model_dump(mode="json"),
    )
    return signal


def _seed(client):
    org = _org(client, "Alpha")
    user = _user(client, "Ada")
    member = _membership(client, org.id, user, "owner", age_seconds=10)
    return org, user, member


def test_overview_of_membership_with_no_activity(client):
    _clear(client)
    org, user, member = _seed(client)

    response = _overview(client, org.id, user.id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["org_id"] == str(org.id)
    assert body["org_name"] == "Alpha"
    assert body["org_slug"] == "alpha"
    assert body["user_id"] == str(user.id)
    assert body["email"] == "ada@studio.local"
    assert body["display_name"] == "Ada"
    assert body["avatar_url"] is None
    assert body["role"] == "owner"
    assert body["joined_at"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {
        "projects": 0,
        "conversations": 0,
        "comments": 0,
        "presence": 0,
    }
    assert body["recent_projects"] == []
    assert body["recent_comments"] == []
    assert body["generated_at"]


def test_counts_never_bounded_by_recent_limit_and_pages_newest_first(client):
    _clear(client)
    org, user, _ = _seed(client)
    projects = [_project(client, org.id, user, f"P{i}", age_seconds=i) for i in range(4)]
    comments = [
        _comment(client, projects[0].id, user, age_seconds=i) for i in range(4)
    ]
    for i in range(2):
        _conversation(client, projects[0].id, user, age_seconds=i)
        _presence(client, projects[0].id, user, age_seconds=i)

    full = _overview(client, org.id, user.id, recent_limit=50).json()
    assert full["counts"] == {
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

    bounded = _overview(client, org.id, user.id, recent_limit=2).json()
    assert bounded["counts"] == full["counts"]
    assert [p["id"] for p in bounded["recent_projects"]] == [
        str(p.id) for p in projects[:2]
    ]
    assert [c["id"] for c in bounded["recent_comments"]] == [
        str(c.id) for c in comments[:2]
    ]


def test_activity_is_scoped_to_the_org_and_the_user(client):
    _clear(client)
    org, user, _ = _seed(client)
    other_org = _org(client, "Beta")
    other_user = _user(client, "Grace")
    mine = _project(client, org.id, user, "Mine")

    # Same user, different org — excluded.
    _project(client, other_org.id, user, "Other org")
    _comment(client, _project(client, other_org.id, user, "Other org 2").id, user)
    # Same org, different user — excluded.
    _project(client, org.id, other_user, "Theirs")
    _comment(client, mine.id, other_user)
    _conversation(client, mine.id, other_user)
    _presence(client, mine.id, other_user)
    # Same org + user — counted.
    _comment(client, mine.id, user)
    _conversation(client, mine.id, user)
    _presence(client, mine.id, user)

    body = _overview(client, org.id, user.id).json()
    assert body["counts"] == {
        "projects": 1,
        "conversations": 1,
        "comments": 1,
        "presence": 1,
    }
    assert [p["id"] for p in body["recent_projects"]] == [str(mine.id)]


def test_malformed_and_mismatched_membership_documents_are_skipped(client):
    _clear(client)
    org, user, _ = _seed(client)

    # A membership of the same user to a different org must not be picked up.
    other_org_id = uuid4()
    wrong_org = Member(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        role="admin",
        joined_at=utcnow(),
    )
    doc = wrong_org.model_dump(mode="json")
    doc["_org_id"] = str(other_org_id)
    client.app.state.store.put(Collections.MEMBERS, f"other:{user.id}", doc)
    # A malformed document (no role) in the target org must be skipped.
    bad = Member(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        role="member",
        joined_at=utcnow(),
    ).model_dump(mode="json")
    bad["_org_id"] = str(org.id)
    del bad["role"]
    client.app.state.store.put(Collections.MEMBERS, f"bad:{user.id}", bad)

    body = _overview(client, org.id, user.id).json()
    assert body["role"] == "owner"  # the well-formed seeded membership wins


def test_unknown_org_uses_shared_404_envelope(client):
    _clear(client)
    user = _user(client, "Ada")
    response = _overview(client, uuid4(), user.id)
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "organization_not_found"


def test_unknown_user_uses_shared_404_envelope(client):
    _clear(client)
    org = _org(client, "Alpha")
    response = _overview(client, org.id, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "user_not_found"


def test_missing_membership_uses_shared_404_envelope(client):
    _clear(client)
    org = _org(client, "Alpha")
    user = _user(client, "Ada")
    response = _overview(client, org.id, user.id)
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "membership_not_found"


def test_malformed_ids_use_shared_422_envelope(client):
    _clear(client)
    org, user, _ = _seed(client)
    for path in (
        f"{PREFIX}/orgs/not-a-uuid/members/{user.id}/overview",
        f"{PREFIX}/orgs/{org.id}/members/not-a-uuid/overview",
    ):
        response = client.get(path)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    _clear(client)
    org, user, _ = _seed(client)
    for limit in (0, 51):
        response = _overview(client, org.id, user.id, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
