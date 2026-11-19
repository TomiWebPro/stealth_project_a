"""Authoritative organization-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.schemas.auth import Member, Organization, Project
from app.schemas.common import utcnow
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "org_id",
    "name",
    "slug",
    "member_count",
    "project_count",
    "created_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/orgs/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _seed_org(client, *, name="Org", created_at=None):
    org = Organization(
        id=uuid4(),
        name=name,
        slug=f"org-{uuid4()}",
        created_at=created_at or utcnow(),
        metadata={},
    )
    client.app.state.store.put(
        Collections.ORGANIZATIONS, str(org.id), org.model_dump(mode="json")
    )
    return org


def _seed_member(client, org_id, *, role="member", malformed=False):
    member = Member(
        user_id=uuid4(),
        email=f"{uuid4()}@example.com",
        display_name="Member",
        role=role,
        joined_at=utcnow(),
    )
    document = member.model_dump(mode="json")
    document["_org_id"] = "not-a-uuid" if malformed else str(org_id)
    client.app.state.store.put(
        Collections.MEMBERS, f"member:{member.user_id}", document
    )
    return member


def _seed_project(client, org_id, *, age_seconds=0):
    now = utcnow() - timedelta(seconds=age_seconds)
    project = Project(
        id=uuid4(),
        org_id=org_id,
        name=f"Project {uuid4()}",
        created_by=uuid4(),
        created_at=now,
        updated_at=now,
    )
    client.app.state.store.put(
        Collections.PROJECTS, str(project.id), project.model_dump(mode="json")
    )
    return project


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["org_id"]),
        reverse=True,
    )


def test_organization_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_organization_feed_is_newest_first_with_joined_counts(client):
    _clear(client)
    now = utcnow()
    older = _seed_org(client, name="Older", created_at=now - timedelta(hours=2))
    newer = _seed_org(client, name="Newer", created_at=now)

    _seed_member(client, older.id, role="owner")
    _seed_member(client, older.id, role="member")
    _seed_member(client, newer.id, role="admin")
    _seed_project(client, older.id)
    _seed_project(client, older.id)
    _seed_project(client, newer.id)

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 2
    items = body["items"]
    assert len(items) == 2
    assert _sorted_desc(items)
    for item in items:
        assert set(item) == _ITEM_KEYS

    newest = items[0]
    assert newest["org_id"] == str(newer.id)
    assert newest["name"] == "Newer"
    assert newest["slug"] == newer.slug
    assert newest["member_count"] == 1
    assert newest["project_count"] == 1

    oldest = items[1]
    assert oldest["org_id"] == str(older.id)
    assert oldest["name"] == "Older"
    assert oldest["member_count"] == 2
    assert oldest["project_count"] == 2


def test_organization_feed_limit_bounds_page_but_not_total(client):
    _clear(client)
    for i in range(4):
        _seed_org(client, name=f"Org {i}", created_at=utcnow() - timedelta(seconds=i))

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_organization_feed_ignores_orphan_and_malformed_members(client):
    _clear(client)
    org = _seed_org(client)
    keep = _seed_member(client, org.id, role="viewer")

    # A member referencing an unknown org and a malformed discriminator are skipped.
    _seed_member(client, uuid4(), role="owner")
    _seed_member(client, org.id, role="admin", malformed=True)

    body = _feed(client).json()
    assert body["total"] == 1
    assert body["items"][0]["member_count"] == 1
    assert keep is not None


def test_organization_feed_ignores_projects_of_unknown_orgs(client):
    _clear(client)
    org = _seed_org(client)
    _seed_project(client, org.id)
    _seed_project(client, uuid4())  # orphan project, not joined

    assert _feed(client).json()["items"][0]["project_count"] == 1


def test_organization_feed_total_agrees_with_org_stats(client):
    _clear(client)
    o1 = _seed_org(client)
    o2 = _seed_org(client)
    _seed_member(client, o1.id, role="owner")
    _seed_member(client, o1.id, role="member")
    _seed_member(client, o2.id, role="viewer")
    _seed_project(client, o1.id)

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/orgs/stats").json()
    assert feed["total"] == stats["total_organizations"] == 2
    assert sum(item["member_count"] for item in feed["items"]) == stats["total_members"]


def test_organization_feed_is_derived_live_from_the_store(client):
    _clear(client)
    assert _feed(client).json()["total"] == 0

    org = _seed_org(client)
    member = _seed_member(client, org.id, role="owner")
    assert _feed(client).json()["items"][0]["member_count"] == 1

    client.app.state.store.delete(Collections.MEMBERS, f"member:{member.user_id}")
    assert _feed(client).json()["items"][0]["member_count"] == 0

    client.app.state.store.delete(Collections.ORGANIZATIONS, str(org.id))
    assert _feed(client).json()["total"] == 0


def test_organization_feed_literal_routes_win_over_org_id(client):
    org = _seed_org(client)

    assert _feed(client).status_code == 200
    assert client.get(f"{PREFIX}/organizations/feed").status_code == 200
    detail = client.get(f"{PREFIX}/orgs/{org.id}")
    assert detail.status_code == 200
    assert detail.json()["id"] == str(org.id)


def test_organization_feed_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert error["request_id"] == response.headers["X-Request-ID"]
