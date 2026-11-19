"""Authoritative organization/membership statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "total_organizations",
    "total_members",
    "total_users",
    "by_role",
    "by_organization",
    "average_members_per_org",
    "newest_org_at",
    "generated_at",
}
_ROLES = [
    {"role": "owner", "members": 0},
    {"role": "admin", "members": 0},
    {"role": "member", "members": 0},
    {"role": "viewer", "members": 0},
]


def _stats(client, **params):
    return client.get(f"{PREFIX}/orgs/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _seed_org(client, *, org_id=None, name="Org", created_at=None):
    from app.schemas.auth import Organization
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    org = Organization(
        id=org_id or uuid4(),
        name=name,
        slug=f"org-{uuid4()}",
        created_at=created_at or utcnow(),
        metadata={},
    )
    client.app.state.store.put(
        Collections.ORGANIZATIONS, str(org.id), org.model_dump(mode="json")
    )
    return org


def _seed_member(client, org_id, *, role="member"):
    from app.schemas.auth import Member
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    member = Member(
        user_id=uuid4(),
        email=f"{uuid4()}@example.com",
        display_name="Member",
        role=role,
        joined_at=utcnow(),
    )
    document = member.model_dump(mode="json")
    document["_org_id"] = str(org_id)
    client.app.state.store.put(
        Collections.MEMBERS, f"{org_id}:{member.user_id}", document
    )
    return member


def _seed_user(client):
    from app.schemas.auth import User
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    user = User(
        id=uuid4(),
        email=f"{uuid4()}@example.com",
        display_name="User",
        avatar_url=None,
        created_at=utcnow(),
    )
    client.app.state.store.put(
        Collections.USERS, str(user.id), user.model_dump(mode="json")
    )
    return user


def test_organization_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_organizations"] == 0
    assert body["total_members"] == 0
    assert body["total_users"] == 0
    assert body["by_role"] == _ROLES
    assert body["by_organization"] == []
    assert body["average_members_per_org"] == 0.0
    assert body["newest_org_at"] is None
    assert body["generated_at"]


def test_organization_stats_derives_totals_breakdowns_and_recency(client):
    from app.schemas.common import utcnow

    _clear(client)
    now = utcnow()
    o1 = _seed_org(client, name="Older", created_at=now - timedelta(hours=2))
    o2 = _seed_org(client, name="Newer", created_at=now)

    _seed_member(client, o1.id, role="owner")
    _seed_member(client, o1.id, role="member")
    _seed_member(client, o1.id, role="viewer")
    _seed_member(client, o2.id, role="admin")
    _seed_member(client, o2.id, role="admin")
    for _ in range(3):
        _seed_user(client)

    body = _stats(client).json()
    assert body["total_organizations"] == 2
    assert body["total_members"] == 5
    assert body["total_users"] == 3
    assert body["by_role"] == [
        {"role": "owner", "members": 1},
        {"role": "admin", "members": 2},
        {"role": "member", "members": 1},
        {"role": "viewer", "members": 1},
    ]
    # Descending member count then org id: o1 (3) before o2 (2).
    assert body["by_organization"] == [
        {"org_id": str(o1.id), "members": 3},
        {"org_id": str(o2.id), "members": 2},
    ]
    assert body["average_members_per_org"] == 2.5
    assert body["newest_org_at"] == o2.created_at.isoformat().replace("+00:00", "Z")


def test_organization_stats_org_scope_and_unknown_org(client):
    _clear(client)
    o1 = _seed_org(client, name="One")
    o2 = _seed_org(client, name="Two")
    _seed_member(client, o1.id, role="owner")
    _seed_member(client, o1.id, role="member")
    _seed_member(client, o2.id, role="admin")
    _seed_user(client)  # total_users is global, independent of the scope

    scoped = _stats(client, org_id=o1.id)
    assert scoped.status_code == 200
    scoped_body = scoped.json()
    assert scoped_body["total_organizations"] == 1
    assert scoped_body["total_members"] == 2
    assert scoped_body["total_users"] == 1
    assert scoped_body["by_role"] == [
        {"role": "owner", "members": 1},
        {"role": "admin", "members": 0},
        {"role": "member", "members": 1},
        {"role": "viewer", "members": 0},
    ]
    assert scoped_body["by_organization"] == [{"org_id": str(o1.id), "members": 2}]
    assert scoped_body["average_members_per_org"] == 2.0
    assert scoped_body["newest_org_at"] == o1.created_at.isoformat().replace("+00:00", "Z")

    # An unknown but well-formed org is a zero-filled snapshot, matching
    # GET /projects?org_id= — but total_users stays global.
    missing = _stats(client, org_id=uuid4()).json()
    assert missing["total_organizations"] == 0
    assert missing["total_members"] == 0
    assert missing["total_users"] == 1
    assert missing["by_role"] == _ROLES
    assert missing["by_organization"] == []
    assert missing["average_members_per_org"] == 0.0
    assert missing["newest_org_at"] is None

    all_body = _stats(client).json()
    assert all_body["total_organizations"] == 2
    assert all_body["total_members"] == 3


def test_organization_stats_rejects_malformed_org_id(client):
    response = _stats(client, org_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_organization_stats_literal_routes_win_over_org_id(client):
    org = _seed_org(client)

    assert _stats(client).status_code == 200
    assert client.get(f"{PREFIX}/organizations/stats").status_code == 200
    detail = client.get(f"{PREFIX}/orgs/{org.id}")
    assert detail.status_code == 200
    assert detail.json()["id"] == str(org.id)


def test_organization_stats_ignores_orphan_and_malformed_member_documents(client):
    from app.schemas.auth import Member
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    _clear(client)
    org = _seed_org(client)
    _seed_member(client, org.id, role="viewer")

    orphan = Member(
        user_id=uuid4(),
        email=f"{uuid4()}@example.com",
        display_name="Orphan",
        role="owner",
        joined_at=utcnow(),
    ).model_dump(mode="json")
    orphan["_org_id"] = str(uuid4())  # references a non-existent org
    client.app.state.store.put(Collections.MEMBERS, f"orphan:{uuid4()}", orphan)

    malformed = Member(
        user_id=uuid4(),
        email=f"{uuid4()}@example.com",
        display_name="Malformed",
        role="admin",
        joined_at=utcnow(),
    ).model_dump(mode="json")
    malformed["_org_id"] = "not-a-uuid"
    client.app.state.store.put(Collections.MEMBERS, f"bad:{uuid4()}", malformed)

    body = _stats(client).json()
    assert body["total_members"] == 1
    assert body["by_role"] == [
        {"role": "owner", "members": 0},
        {"role": "admin", "members": 0},
        {"role": "member", "members": 0},
        {"role": "viewer", "members": 1},
    ]
    assert body["by_organization"] == [{"org_id": str(org.id), "members": 1}]


def test_organization_stats_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    _clear(client)
    assert _stats(client).json()["total_organizations"] == 0

    org = _seed_org(client)
    member = _seed_member(client, org.id, role="owner")
    first = _stats(client).json()
    assert first["total_organizations"] == 1
    assert first["total_members"] == 1
    assert first["by_role"][0] == {"role": "owner", "members": 1}
    assert first["average_members_per_org"] == 1.0

    client.app.state.store.delete(Collections.MEMBERS, f"{org.id}:{member.user_id}")
    second = _stats(client).json()
    assert second["total_members"] == 0
    assert second["by_organization"] == [{"org_id": str(org.id), "members": 0}]
    assert second["average_members_per_org"] == 0.0

    _clear(client)
    third = _stats(client).json()
    assert third["total_organizations"] == 0
    assert third["newest_org_at"] is None
