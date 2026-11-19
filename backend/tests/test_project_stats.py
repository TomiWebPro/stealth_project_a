"""Authoritative project portfolio statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "total",
    "by_lifecycle",
    "active",
    "archived",
    "total_assets",
    "total_conversations",
    "total_jobs",
    "average_assets_per_project",
    "average_jobs_per_project",
    "newest_project_at",
    "generated_at",
}
_LIFECYCLES = [
    {"lifecycle": "active", "count": 0},
    {"lifecycle": "archived", "count": 0},
]


def _put(client, collection, model):
    client.app.state.store.put(collection, str(model.id), model.model_dump(mode="json"))
    return model


def _project(client, *, org_id=None, name="Project", archived=False, created_at=None):
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    return _put(
        client,
        Collections.PROJECTS,
        Project(
            id=uuid4(),
            org_id=org_id or uuid4(),
            name=name,
            created_by=uuid4(),
            created_at=created_at or now,
            updated_at=now,
            archived=archived,
        ),
    )


def _asset(client, project_id, *, status="ready", created_at=None):
    from app.schemas.asset import Asset, StorageRef
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    return _put(
        client,
        Collections.ASSETS,
        Asset(
            id=uuid4(),
            project_id=project_id,
            type="image",
            name="Seeded asset",
            status=status,
            creator_id=uuid4(),
            storage=StorageRef(
                key=f"{uuid4()}.bin",
                size_bytes=100,
                content_type="application/octet-stream",
            ),
            created_at=created_at or now,
            updated_at=now,
        ),
    )


def _conversation(client, project_id):
    from app.schemas.common import utcnow
    from app.schemas.conversation import Conversation
    from app.storage.base import Collections

    now = utcnow()
    return _put(
        client,
        Collections.CONVERSATIONS,
        Conversation(
            id=uuid4(),
            project_id=project_id,
            title="Seeded conversation",
            created_by=uuid4(),
            created_at=now,
            updated_at=now,
        ),
    )


def _job(client, project_id):
    from app.schemas.common import utcnow
    from app.schemas.operation import Job
    from app.storage.base import Collections

    now = utcnow()
    return _put(
        client,
        Collections.JOBS,
        Job(
            id=uuid4(),
            project_id=project_id,
            operation_id="text-to-image",
            schema_version="1.0.0",
            status="queued",
            created_by=uuid4(),
            created_at=now,
        ),
    )


def _stats(client, **params):
    return client.get(f"{PREFIX}/projects/stats", params=params)


def test_project_stats_empty_store_is_zero_filled(client):
    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["active"] == 0
    assert body["archived"] == 0
    assert body["by_lifecycle"] == _LIFECYCLES
    assert body["total_assets"] == 0
    assert body["total_conversations"] == 0
    assert body["total_jobs"] == 0
    assert body["average_assets_per_project"] == 0.0
    assert body["average_jobs_per_project"] == 0.0
    assert body["newest_project_at"] is None
    assert body["generated_at"]


def test_project_stats_derives_totals_lifecycle_averages_and_recency(client):
    from app.schemas.common import utcnow

    now = utcnow()
    p1 = _project(client, name="Active", created_at=now - timedelta(hours=2))
    p2 = _project(client, name="Archived", archived=True, created_at=now)

    _asset(client, p1.id)
    _asset(client, p1.id)
    _asset(client, p1.id, status="deleted")  # excluded everywhere
    _asset(client, p2.id)
    _conversation(client, p1.id)
    _conversation(client, p1.id)
    _conversation(client, p2.id)
    for _ in range(3):
        _job(client, p1.id)
    _job(client, p2.id)

    body = _stats(client).json()
    assert body["total"] == 2
    assert body["active"] == 1
    assert body["archived"] == 1
    assert body["by_lifecycle"] == [
        {"lifecycle": "active", "count": 1},
        {"lifecycle": "archived", "count": 1},
    ]
    assert body["total_assets"] == 3
    assert body["total_conversations"] == 3
    assert body["total_jobs"] == 4
    assert body["average_assets_per_project"] == 1.5
    assert body["average_jobs_per_project"] == 2.0
    assert body["newest_project_at"] == p2.created_at.isoformat().replace("+00:00", "Z")


def test_project_stats_org_scope_and_unknown_org(client):
    org_a, org_b, org_missing = uuid4(), uuid4(), uuid4()
    a1 = _project(client, org_id=org_a, name="A1")
    a2 = _project(client, org_id=org_a, name="A2", archived=True)
    b1 = _project(client, org_id=org_b, name="B1")

    _asset(client, a1.id)
    _asset(client, a2.id)
    _asset(client, b1.id)
    _asset(client, b1.id)
    _conversation(client, a1.id)
    _job(client, b1.id)

    scoped = _stats(client, org_id=org_a)
    assert scoped.status_code == 200
    scoped_body = scoped.json()
    assert scoped_body["total"] == 2
    assert scoped_body["active"] == 1
    assert scoped_body["archived"] == 1
    assert scoped_body["total_assets"] == 2
    assert scoped_body["total_conversations"] == 1
    assert scoped_body["total_jobs"] == 0
    assert scoped_body["average_assets_per_project"] == 1.0
    assert scoped_body["average_jobs_per_project"] == 0.0

    other = _stats(client, org_id=org_b).json()
    assert other["total"] == 1
    assert other["total_assets"] == 2
    assert other["total_jobs"] == 1

    missing = _stats(client, org_id=org_missing).json()
    assert missing["total"] == 0
    assert missing["by_lifecycle"] == _LIFECYCLES
    assert missing["average_assets_per_project"] == 0.0
    assert missing["newest_project_at"] is None

    all_body = _stats(client).json()
    assert all_body["total"] == 3
    assert all_body["total_assets"] == 4
    assert all_body["total_jobs"] == 1


def test_project_stats_excludes_deleted_assets_from_every_metric(client):
    project = _project(client)
    _asset(client, project.id)
    _asset(client, project.id, status="deleted")

    body = _stats(client).json()
    assert body["total_assets"] == 1
    assert body["average_assets_per_project"] == 1.0


def test_project_stats_rejects_malformed_org_id(client):
    response = _stats(client, org_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_project_stats_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    first = _stats(client).json()
    assert first["total"] == 0

    project = _project(client)
    live_asset = _asset(client, project.id)
    _conversation(client, project.id)
    _job(client, project.id)
    second = _stats(client).json()
    assert second["total"] == 1
    assert second["total_assets"] == 1
    assert second["total_conversations"] == 1
    assert second["total_jobs"] == 1
    assert second["average_jobs_per_project"] == 1.0

    # Derivation reflects status changes live: flipping the only asset to
    # deleted removes it without any rebuild.
    client.app.state.store.put(
        Collections.ASSETS,
        str(live_asset.id),
        {**live_asset.model_dump(mode="json"), "status": "deleted"},
    )
    third = _stats(client).json()
    assert third["total_assets"] == 0
    assert third["average_assets_per_project"] == 0.0

    client.app.state.store.clear()
    fourth = _stats(client).json()
    assert fourth["total"] == 0
    assert fourth["newest_project_at"] is None
