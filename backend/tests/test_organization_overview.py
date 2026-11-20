"""Authoritative organization-overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.schemas.auth import Member, Organization, Project
from app.schemas.common import utcnow
from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "org_id",
    "name",
    "slug",
    "created_at",
    "counts",
    "by_role",
    "recent_members",
    "recent_projects",
    "generated_at",
}
_COUNT_KEYS = {"members", "projects"}
_ROLES = ["owner", "admin", "member", "viewer"]


def _overview(client, org_id, *, query=""):
    url = f"{PREFIX}/orgs/{org_id}/overview"
    return client.get(url + query)


def _store(client):
    return client.app.state.store


def _seed_org(client, *, org_id=None, name="Test Org", slug="test-org", created_at=None):
    org = Organization(
        id=org_id or uuid4(),
        name=name,
        slug=slug,
        created_at=created_at or utcnow(),
        metadata={"source": "test"},
    )
    _store(client).put(Collections.ORGANIZATIONS, str(org.id), org.model_dump(mode="json"))
    return org


def _seed_member(client, org_id, *, role="member", joined_at=None, user_id=None):
    user_id = user_id or uuid4()
    member = Member(
        user_id=user_id,
        email=f"{user_id}@example.com",
        display_name=f"User {user_id}",
        role=role,
        joined_at=joined_at or utcnow(),
    )
    document = member.model_dump(mode="json")
    document["_org_id"] = str(org_id)
    _store(client).put(Collections.MEMBERS, f"{org_id}:{user_id}", document)
    return member


def _seed_project(client, org_id, *, name="Test Project", created_at=None):
    timestamp = created_at or utcnow()
    project = Project(
        id=uuid4(),
        org_id=org_id,
        name=name,
        description=None,
        created_by=uuid4(),
        created_at=timestamp,
        updated_at=timestamp,
        archived=False,
    )
    _store(client).put(Collections.PROJECTS, str(project.id), project.model_dump(mode="json"))
    return project


def test_overview_of_seeded_default_org_has_full_shape(client):
    org_id = client.app.state.settings.default_org_id

    response = _overview(client, org_id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["org_id"] == str(org_id)
    assert body["name"] == "Studio Org"
    assert body["slug"] == "studio"
    assert body["created_at"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {"members": 1, "projects": 0}
    assert [bucket["role"] for bucket in body["by_role"]] == _ROLES
    assert body["by_role"] == [
        {"role": "owner", "members": 1},
        {"role": "admin", "members": 0},
        {"role": "member", "members": 0},
        {"role": "viewer", "members": 0},
    ]
    assert len(body["recent_members"]) == 1
    assert body["recent_projects"] == []
    assert body["generated_at"]


def test_counts_and_role_breakdown_agree_and_zero_fill(client):
    org = _seed_org(client, name="Role Org", slug="role-org")
    for role in _ROLES:
        _seed_member(client, org.id, role=role)
    for index in range(3):
        _seed_project(client, org.id, name=f"Project {index}")

    body = _overview(client, org.id).json()
    assert body["counts"] == {"members": 4, "projects": 3}
    assert body["by_role"] == [
        {"role": "owner", "members": 1},
        {"role": "admin", "members": 1},
        {"role": "member", "members": 1},
        {"role": "viewer", "members": 1},
    ]
    assert sum(bucket["members"] for bucket in body["by_role"]) == body["counts"]["members"]


def test_recent_lists_newest_first_bounded_but_counts_whole_scope(client):
    org = _seed_org(client)
    now = utcnow()
    for days in (5, 1, 3, 2):
        _seed_member(client, org.id, joined_at=now - timedelta(days=days))
    for days in (9, 4, 7):
        _seed_project(client, org.id, created_at=now - timedelta(days=days))

    body = _overview(client, org.id, query="?recent_limit=2").json()
    assert body["counts"] == {"members": 4, "projects": 3}
    assert len(body["recent_members"]) == 2
    assert len(body["recent_projects"]) == 2
    member_times = [member["joined_at"] for member in body["recent_members"]]
    assert member_times == sorted(member_times, reverse=True)
    project_times = [project["created_at"] for project in body["recent_projects"]]
    assert project_times == sorted(project_times, reverse=True)
    # Newest member is 1 day old; newest project is 4 days old.
    assert body["recent_members"][0]["joined_at"] == (now - timedelta(days=1)).isoformat().replace(
        "+00:00", "Z"
    )
    assert body["recent_projects"][0]["created_at"] == (now - timedelta(days=4)).isoformat().replace(
        "+00:00", "Z"
    )


def test_empty_org_has_zero_counts_and_empty_recent_lists(client):
    org = _seed_org(client, name="Empty Org", slug="empty-org")

    body = _overview(client, org.id).json()
    assert body["counts"] == {"members": 0, "projects": 0}
    assert body["by_role"] == [{"role": role, "members": 0} for role in _ROLES]
    assert body["recent_members"] == []
    assert body["recent_projects"] == []


def test_recent_limit_bounds_are_validated(client):
    org_id = client.app.state.settings.default_org_id
    for limit in (0, 51):
        response = _overview(client, org_id, query=f"?recent_limit={limit}")
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"


def test_unknown_org_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "organization_not_found"
    assert error["request_id"]


def test_malformed_id_uses_shared_422_envelope(client):
    response = _overview(client, "not-a-uuid")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_literal_overview_path_is_not_parsed_as_org_id(client):
    response = client.get(f"{PREFIX}/orgs/not-a-uuid/overview")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_organizations_alias_serves_the_same_snapshot(client):
    org_id = client.app.state.settings.default_org_id
    canonical = _overview(client, org_id).json()
    aliased = client.get(f"{PREFIX}/organizations/{org_id}/overview")
    assert aliased.status_code == 200
    body = aliased.json()
    assert body["org_id"] == canonical["org_id"]
    assert body["counts"] == canonical["counts"]
