"""Authoritative job-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "job_id",
    "project_id",
    "project_name",
    "operation_id",
    "status",
    "progress",
    "attempt",
    "created_by",
    "created_at",
    "started_at",
    "finished_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/jobs/feed", params=params)


def _project(client, name="Feed Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def _seed_job(
    client,
    project_id,
    *,
    status="queued",
    operation_id="text-to-image",
    progress=0.0,
    attempt=1,
    created_at=None,
    started_at=None,
    finished_at=None,
):
    """Write a Job straight to the authoritative store with deterministic timing."""
    from app.schemas.common import utcnow
    from app.schemas.operation import Job
    from app.storage.base import Collections

    now = utcnow()
    job = Job(
        id=uuid4(),
        project_id=project_id,
        operation_id=operation_id,
        schema_version="1.0.0",
        status=status,
        progress=progress,
        attempt=attempt,
        created_by=uuid4(),
        created_at=created_at or now,
        started_at=started_at,
        finished_at=finished_at,
    )
    client.app.state.store.put(Collections.JOBS, str(job.id), job.model_dump(mode="json"))
    return job


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["job_id"]),
        reverse=True,
    )


def test_job_feed_empty_store_is_zero_filled(client):
    client.app.state.store.clear()

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_job_feed_is_newest_first_with_project_identity_and_job_fields(client):
    from app.schemas.common import utcnow

    client.app.state.store.clear()
    p1 = _project(client, "Alpha")
    p2 = _project(client, "Beta")
    now = utcnow()

    j1 = _seed_job(
        client,
        p1,
        status="succeeded",
        operation_id="text-to-image",
        progress=1.0,
        attempt=2,
        created_at=now - timedelta(hours=2),
        started_at=now - timedelta(hours=2) + timedelta(seconds=5),
        finished_at=now - timedelta(hours=2) + timedelta(seconds=30),
    )
    j2 = _seed_job(
        client,
        p1,
        status="running",
        operation_id="lora-train",
        progress=0.4,
        created_at=now,
    )
    j3 = _seed_job(
        client,
        p2,
        status="failed",
        operation_id="image-to-video",
        progress=0.1,
        created_at=now - timedelta(hours=1),
    )

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)  # deterministic (created_at, job_id) order
    assert [item["job_id"] for item in items] == [str(j2.id), str(j3.id), str(j1.id)]

    by_id = {item["job_id"]: item for item in items}
    assert set(by_id) == {str(j1.id), str(j2.id), str(j3.id)}
    assert set(by_id[str(j1.id)]) == _ITEM_KEYS

    first = by_id[str(j1.id)]
    assert first["project_id"] == p1
    assert first["project_name"] == "Alpha"
    assert first["operation_id"] == "text-to-image"
    assert first["status"] == "succeeded"
    assert first["progress"] == 1.0
    assert first["attempt"] == 2
    assert first["created_by"]
    assert first["created_at"] and first["started_at"] and first["finished_at"]

    assert by_id[str(j2.id)]["project_name"] == "Alpha"
    assert by_id[str(j2.id)]["operation_id"] == "lora-train"
    assert by_id[str(j2.id)]["status"] == "running"
    assert by_id[str(j2.id)]["started_at"] is None
    assert by_id[str(j2.id)]["finished_at"] is None
    assert by_id[str(j3.id)]["project_name"] == "Beta"


def test_job_feed_status_filter_narrows_derivation(client):
    client.app.state.store.clear()
    project_id = _project(client)
    queued = _seed_job(client, project_id, status="queued")
    running = _seed_job(client, project_id, status="running")
    succeeded = _seed_job(client, project_id, status="succeeded")

    queued_feed = _feed(client, status="queued").json()
    assert queued_feed["total"] == 1
    assert [item["job_id"] for item in queued_feed["items"]] == [str(queued.id)]
    assert queued_feed["items"][0]["status"] == "queued"

    running_feed = _feed(client, status="running").json()
    assert running_feed["total"] == 1
    assert [item["job_id"] for item in running_feed["items"]] == [str(running.id)]

    succeeded_feed = _feed(client, status="succeeded").json()
    assert succeeded_feed["total"] == 1
    assert [item["job_id"] for item in succeeded_feed["items"]] == [str(succeeded.id)]

    assert _feed(client).json()["total"] == 3


def test_job_feed_project_scope_narrows_derivation(client):
    client.app.state.store.clear()
    p1 = _project(client, "Alpha")
    p2 = _project(client, "Beta")
    a_job = _seed_job(client, p1)
    _seed_job(client, p2)

    scoped = _feed(client, project_id=p1).json()
    assert scoped["total"] == 1
    assert [item["job_id"] for item in scoped["items"]] == [str(a_job.id)]
    assert scoped["items"][0]["project_name"] == "Alpha"

    assert _feed(client).json()["total"] == 2
    assert _feed(client, project_id=p2).json()["total"] == 1


def test_job_feed_limit_bounds_page_but_not_total(client):
    client.app.state.store.clear()
    project_id = _project(client)
    for index in range(4):
        _seed_job(client, project_id, operation_id=f"op-{index}")

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_job_feed_total_agrees_with_job_stats(client):
    client.app.state.store.clear()
    p1 = _project(client, "Alpha")
    p2 = _project(client, "Beta")
    _seed_job(client, p1, status="queued")
    _seed_job(client, p1, status="running")
    _seed_job(client, p2, status="succeeded")
    _seed_job(client, p2, status="failed")
    _seed_job(client, p2, status="canceled")

    feed = _feed(client).json()
    stats = client.get(f"{PREFIX}/jobs/stats").json()
    assert feed["total"] == stats["total"] == 5


def test_job_feed_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    client.app.state.store.clear()
    project_id = _project(client)
    assert _feed(client).json()["total"] == 0

    seeded = _seed_job(client, project_id, operation_id="text-to-image")
    second = _feed(client).json()
    assert second["total"] == 1
    assert second["items"][0]["job_id"] == str(seeded.id)
    assert second["items"][0]["operation_id"] == "text-to-image"

    # Removing the job from the authoritative store removes it from the feed.
    client.app.state.store.delete(Collections.JOBS, str(seeded.id))
    assert _feed(client).json()["total"] == 0


def test_job_feed_unknown_project_uses_shared_404_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_job_feed_malformed_project_id_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_job_feed_invalid_status_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, status="not-a-status")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_job_feed_invalid_limit_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
