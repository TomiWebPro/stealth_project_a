"""Authoritative project-overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "project_id",
    "project_name",
    "lifecycle",
    "created_at",
    "counts",
    "recent_jobs",
    "recent_assets",
    "generated_at",
}
_COUNT_KEYS = {
    "assets",
    "conversations",
    "jobs",
    "comments",
    "publishes",
    "versions",
    "collaborators",
}


def _overview(client, project_id, **params):
    return client.get(f"{PREFIX}/projects/{project_id}/overview", params=params)


def _project(client, name="Overview Project", *, archived=False):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    project = response.json()
    if archived:
        patch = client.patch(f"{PREFIX}/projects/{project['id']}", json={"archived": True})
        assert patch.status_code == 200
        project = patch.json()
    return project


def _store(client):
    return client.app.state.store


def _seed_asset(client, project_id, *, name="Seeded asset", status="ready", created_at=None, receipt=None):
    from app.schemas.asset import Asset, StorageRef
    from app.schemas.common import utcnow

    now = utcnow()
    asset = Asset(
        id=uuid4(),
        project_id=project_id,
        type="image",
        name=name,
        status=status,
        creator_id=uuid4(),
        storage=StorageRef(
            key=f"{uuid4()}.bin",
            size_bytes=100,
            content_type="application/octet-stream",
        ),
        metadata={"publish_receipt": receipt} if receipt is not None else {},
        created_at=created_at or now,
        updated_at=now,
    )
    _store(client).put("assets", str(asset.id), asset.model_dump(mode="json"))
    return asset


def _seed_version(client, asset_id, version=1):
    from app.schemas.asset import AssetVersion, StorageRef
    from app.schemas.common import utcnow

    record = AssetVersion(
        asset_id=asset_id,
        version=version,
        storage=StorageRef(
            key=f"{uuid4()}.bin",
            size_bytes=100,
            content_type="application/octet-stream",
        ),
        created_at=utcnow(),
        created_by=uuid4(),
    )
    # AssetVersion has no id; use a stable synthetic key in the store.
    key = f"{asset_id}:v{version}"
    _store(client).put("asset_versions", key, record.model_dump(mode="json"))


def _seed_conversation(client, project_id):
    from app.schemas.common import utcnow
    from app.schemas.conversation import Conversation

    now = utcnow()
    record = Conversation(
        id=uuid4(),
        project_id=project_id,
        title="Chat",
        created_by=uuid4(),
        created_at=now,
        updated_at=now,
    )
    _store(client).put("conversations", str(record.id), record.model_dump(mode="json"))


def _seed_job(client, project_id, *, status="queued", created_at=None):
    from app.schemas.common import utcnow
    from app.schemas.operation import Job

    record = Job(
        id=uuid4(),
        project_id=project_id,
        operation_id="text-to-image",
        schema_version="1.0.0",
        status=status,
        created_by=uuid4(),
        created_at=created_at or utcnow(),
    )
    _store(client).put("jobs", str(record.id), record.model_dump(mode="json"))
    return record


def _seed_comment(client, project_id):
    from app.schemas.common import utcnow
    from app.schemas.orchestration import Comment

    record = Comment(
        id=uuid4(),
        project_id=project_id,
        author_id=uuid4(),
        body="A comment",
        created_at=utcnow(),
    )
    _store(client).put("comments", str(record.id), record.model_dump(mode="json"))


def _seed_presence(client, project_id, user_id):
    from app.schemas.common import utcnow
    from app.schemas.orchestration import Presence

    record = Presence(
        user_id=user_id,
        project_id=project_id,
        state="online",
        last_seen_at=utcnow(),
    )
    _store(client).put("presence", f"{project_id}:{user_id}", record.model_dump(mode="json"))


def test_overview_of_empty_project_is_zero_filled(client):
    from app.schemas.common import utcnow

    project = _project(client, "Empty")
    response = _overview(client, project["id"])

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Empty"
    assert body["lifecycle"] == "active"
    assert body["created_at"] == project["created_at"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert all(value == 0 for value in body["counts"].values())
    assert body["recent_jobs"] == []
    assert body["recent_assets"] == []
    assert body["generated_at"]


def test_overview_aggregates_all_domains_for_one_project(client):
    from datetime import UTC, datetime

    now = datetime.now(UTC)
    project = _project(client, "Populated")
    pid = project["id"]
    other = _project(client, "Other")["id"]

    live = _seed_asset(client, pid, name="Live", created_at=now)
    deleted = _seed_asset(client, pid, name="Deleted", status="deleted")
    _seed_asset(client, other, name="Elsewhere")
    _seed_version(client, live.id, 1)
    _seed_version(client, live.id, 2)
    _seed_version(client, deleted.id, 1)  # version of a deleted asset is excluded
    _seed_conversation(client, pid)
    _seed_conversation(client, other)
    _seed_job(client, pid, status="queued", created_at=now - timedelta(hours=1))
    _seed_job(client, pid, status="succeeded", created_at=now - timedelta(hours=2))
    _seed_job(client, other)
    _seed_comment(client, pid)
    _seed_comment(client, other)
    u1, u2 = uuid4(), uuid4()
    _seed_presence(client, pid, u1)
    _seed_presence(client, pid, u2)
    _seed_presence(client, pid, u1)  # same participant again -> no extra collaborator
    _seed_presence(client, other, uuid4())

    response = _overview(client, pid)
    assert response.status_code == 200
    body = response.json()
    counts = body["counts"]
    assert counts["assets"] == 1  # soft-deleted asset excluded
    assert counts["conversations"] == 1
    assert counts["jobs"] == 2
    assert counts["comments"] == 1
    assert counts["publishes"] == 0
    assert counts["versions"] == 2  # only versions of the live asset
    assert counts["collaborators"] == 2  # distinct presence participants

    assert [item["name"] for item in body["recent_assets"]] == ["Live"]
    assert [item["status"] for item in body["recent_jobs"]] == ["queued", "succeeded"]


def test_overview_counts_well_formed_publishes_only(client):
    pid = _project(client, "Publishes")["id"]
    _seed_asset(
        client,
        pid,
        receipt={"version": 1, "size_bytes": 100, "published_at": "2026-01-01T00:00:00Z"},
    )
    _seed_asset(client, pid, receipt={"version": "bad"})  # malformed receipt ignored
    _seed_asset(client, pid, status="deleted", receipt={
        "version": 1, "size_bytes": 100, "published_at": "2026-01-01T00:00:00Z"
    })

    body = _overview(client, pid).json()
    assert body["counts"]["publishes"] == 1


def test_overview_recent_limit_bounds_items_but_not_counts(client):
    from app.schemas.common import utcnow

    pid = _project(client, "Bounded")["id"]
    now = utcnow()
    for index in range(4):
        _seed_asset(client, pid, name=f"A{index}", created_at=now - timedelta(hours=index))
        _seed_job(client, pid, created_at=now - timedelta(hours=index))

    body = _overview(client, pid, recent_limit=2).json()
    assert body["counts"]["assets"] == 4
    assert body["counts"]["jobs"] == 4
    assert len(body["recent_assets"]) == 2
    assert len(body["recent_jobs"]) == 2
    # Newest-first with a deterministic tie-break.
    assert [item["name"] for item in body["recent_assets"]] == ["A0", "A1"]


def test_overview_reflects_archived_lifecycle(client):
    pid = _project(client, "Archived", archived=True)["id"]
    body = _overview(client, pid).json()
    assert body["lifecycle"] == "archived"


def test_unknown_project_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"]


def test_malformed_project_id_uses_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/projects/not-a-uuid/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    pid = _project(client, "Limits")["id"]
    for limit in (0, 51):
        response = _overview(client, pid, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
