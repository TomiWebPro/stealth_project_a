"""Authoritative project-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "project_id",
    "org_id",
    "org_name",
    "name",
    "description",
    "lifecycle",
    "created_by",
    "created_at",
    "updated_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/projects/feed", params=params)


def _put(client, collection, model):
    client.app.state.store.put(collection, str(model.id), model.model_dump(mode="json"))
    return model


def _org(client, name="Feed Org"):
    from app.schemas.auth import Organization
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    return _put(
        client,
        Collections.ORGANIZATIONS,
        Organization(id=uuid4(), name=name, slug=f"org-{uuid4()}", created_at=utcnow()),
    )


def _project(client, org_id, *, name="Feed Project", archived=False, description=None, created_at=None):
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    return _put(
        client,
        Collections.PROJECTS,
        Project(
            id=uuid4(),
            org_id=org_id,
            name=name,
            description=description,
            created_by=uuid4(),
            created_at=created_at or now,
            updated_at=now,
            archived=archived,
        ),
    )


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["project_id"]),
        reverse=True,
    )


def test_project_feed_empty_store_is_zero_filled(client):
    client.app.state.store.clear()

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_project_feed_is_newest_first_with_org_identity_and_project_fields(client):
    from app.schemas.common import utcnow

    client.app.state.store.clear()
    o1 = _org(client, "Alpha Org")
    o2 = _org(client, "Beta Org")
    now = utcnow()

    p1 = _project(client, o1.id, name="Alpha", description="first", created_at=now - timedelta(hours=2))
    p2 = _project(client, o1.id, name="Newer Alpha", created_at=now)
    p3 = _project(
        client,
        o2.id,
        name="Archived Beta",
        archived=True,
        created_at=now - timedelta(hours=1),
    )

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)
    assert [item["project_id"] for item in items] == [str(p2.id), str(p3.id), str(p1.id)]

    by_id = {item["project_id"]: item for item in items}
    assert set(by_id) == {str(p1.id), str(p2.id), str(p3.id)}
    assert set(by_id[str(p1.id)]) == _ITEM_KEYS

    first = by_id[str(p1.id)]
    assert first["org_id"] == str(o1.id)
    assert first["org_name"] == "Alpha Org"
    assert first["name"] == "Alpha"
    assert first["description"] == "first"
    assert first["lifecycle"] == "active"
    assert first["created_by"]
    assert first["created_at"] and first["updated_at"]

    assert by_id[str(p3.id)]["org_name"] == "Beta Org"
    assert by_id[str(p3.id)]["lifecycle"] == "archived"
    assert by_id[str(p2.id)]["description"] is None


def test_project_feed_uses_fallback_for_orphan_project(client):
    client.app.state.store.clear()
    orphan_org = uuid4()  # no Organization document for this id
    project = _project(client, orphan_org, name="Orphan")

    body = _feed(client).json()
    assert body["total"] == 1
    assert body["items"][0]["project_id"] == str(project.id)
    assert body["items"][0]["org_name"] == "Unknown organization"


def test_project_feed_lifecycle_filter_narrows_derivation(client):
    client.app.state.store.clear()
    org_id = _org(client).id
    active = _project(client, org_id, name="Active", archived=False)
    archived = _project(client, org_id, name="Archived", archived=True)

    active_feed = _feed(client, lifecycle="active").json()
    assert active_feed["total"] == 1
    assert [item["project_id"] for item in active_feed["items"]] == [str(active.id)]
    assert active_feed["items"][0]["lifecycle"] == "active"

    archived_feed = _feed(client, lifecycle="archived").json()
    assert archived_feed["total"] == 1
    assert [item["project_id"] for item in archived_feed["items"]] == [str(archived.id)]
    assert archived_feed["items"][0]["lifecycle"] == "archived"

    assert _feed(client).json()["total"] == 2


def test_project_feed_org_scope_narrows_derivation(client):
    client.app.state.store.clear()
    o1 = _org(client, "Alpha Org")
    o2 = _org(client, "Beta Org")
    a_project = _project(client, o1.id, name="Alpha")
    _project(client, o2.id, name="Beta")

    scoped = _feed(client, org_id=o1.id).json()
    assert scoped["total"] == 1
    assert [item["project_id"] for item in scoped["items"]] == [str(a_project.id)]
    assert scoped["items"][0]["org_name"] == "Alpha Org"

    assert _feed(client).json()["total"] == 2
    assert _feed(client, org_id=o2.id).json()["total"] == 1


def test_project_feed_unknown_org_yields_zero_filled_feed(client):
    client.app.state.store.clear()
    _project(client, uuid4(), name="Some project")

    response = _feed(client, org_id=uuid4())
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_project_feed_limit_bounds_page_but_not_total(client):
    client.app.state.store.clear()
    org_id = _org(client).id
    for index in range(4):
        _project(client, org_id, name=f"Project {index}")

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_project_feed_total_agrees_with_project_stats(client):
    client.app.state.store.clear()
    o1 = _org(client, "Alpha Org")
    o2 = _org(client, "Beta Org")
    _project(client, o1.id, archived=False)
    _project(client, o1.id, archived=True)
    _project(client, o2.id, archived=False)

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/projects/stats").json()
    assert feed["total"] == stats["total"] == 3
    assert stats["active"] == 2
    assert stats["archived"] == 1


def test_project_feed_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    client.app.state.store.clear()
    org_id = _org(client).id
    assert _feed(client).json()["total"] == 0

    seeded = _project(client, org_id, name="Text-to-image project")
    second = _feed(client).json()
    assert second["total"] == 1
    assert second["items"][0]["project_id"] == str(seeded.id)
    assert second["items"][0]["name"] == "Text-to-image project"

    # Removing the project from the authoritative store removes it from the feed.
    client.app.state.store.delete(Collections.PROJECTS, str(seeded.id))
    assert _feed(client).json()["total"] == 0


def test_project_feed_malformed_org_id_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, org_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_project_feed_invalid_lifecycle_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, lifecycle="not-a-lifecycle")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_project_feed_invalid_limit_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
