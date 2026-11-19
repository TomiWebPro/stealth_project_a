"""Authoritative job execution statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_STATUSES = ["queued", "running", "succeeded", "failed", "canceled"]
_KEYS = {
    "total",
    "by_status",
    "by_operation",
    "success_rate",
    "in_flight",
    "completed",
    "average_duration_seconds",
    "generated_at",
}


def _project(client, name="Stats Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_job(
    client,
    project_id,
    *,
    status,
    operation_id="text-to-text",
    duration_seconds=None,
):
    """Write a Job straight to the authoritative store with deterministic timing."""
    from app.schemas.common import utcnow
    from app.schemas.operation import Job
    from app.storage.base import Collections

    now = utcnow()
    started_at = now - timedelta(seconds=duration_seconds) if duration_seconds is not None else None
    job = Job(
        id=uuid4(),
        project_id=project_id,
        operation_id=operation_id,
        schema_version="1.0.0",
        status=status,
        progress=0.0,
        attempt=1,
        created_by=uuid4(),
        created_at=now - timedelta(minutes=5),
        started_at=started_at,
        finished_at=now if duration_seconds is not None else None,
    )
    client.app.state.store.put(Collections.JOBS, str(job.id), job.model_dump(mode="json"))
    return job


def _stats(client, **params):
    return client.get(f"{PREFIX}/jobs/stats", params=params)


def test_job_stats_empty_store_is_zero_filled(client):
    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["by_status"] == [{"status": status, "count": 0} for status in _STATUSES]
    assert body["by_operation"] == []
    assert body["success_rate"] == 0.0
    assert body["in_flight"] == 0
    assert body["completed"] == 0
    assert body["average_duration_seconds"] is None
    assert body["generated_at"]


def test_job_stats_derives_counts_outcomes_and_timing(client):
    project = _project(client)
    pid = project["id"]
    _seed_job(client, pid, status="succeeded", duration_seconds=10)
    _seed_job(client, pid, status="succeeded", duration_seconds=10)
    _seed_job(
        client,
        pid,
        status="failed",
        operation_id="text-to-image",
        duration_seconds=4,
    )
    _seed_job(client, pid, status="running", operation_id="image-to-video")
    _seed_job(client, pid, status="queued", operation_id="upscale")
    _seed_job(client, pid, status="canceled")

    body = _stats(client).json()
    assert body["total"] == 6
    assert body["by_status"] == [
        {"status": "queued", "count": 1},
        {"status": "running", "count": 1},
        {"status": "succeeded", "count": 2},
        {"status": "failed", "count": 1},
        {"status": "canceled", "count": 1},
    ]
    # succeeded / (succeeded + failed) = 2 / 3.
    assert body["success_rate"] == 0.667
    assert body["in_flight"] == 2
    assert body["completed"] == 4
    # mean of (10, 10, 4) over jobs with both timing endpoints.
    assert body["average_duration_seconds"] == 8.0

    assert body["by_operation"] == [
        {
            "operation_id": "text-to-text",
            "total": 3,
            "succeeded": 2,
            "failed": 0,
        },
        {
            "operation_id": "image-to-video",
            "total": 1,
            "succeeded": 0,
            "failed": 0,
        },
        {
            "operation_id": "text-to-image",
            "total": 1,
            "succeeded": 0,
            "failed": 1,
        },
        {
            "operation_id": "upscale",
            "total": 1,
            "succeeded": 0,
            "failed": 0,
        },
    ]


def test_job_stats_project_scope_and_unknown_project_404(client):
    p1 = _project(client, "Scoped One")["id"]
    p2 = _project(client, "Scoped Two")["id"]
    _seed_job(client, p1, status="succeeded", duration_seconds=2)
    _seed_job(client, p2, status="failed", duration_seconds=8)
    _seed_job(client, p2, status="running")

    scoped = _stats(client, project_id=p1)
    assert scoped.status_code == 200
    body = scoped.json()
    assert body["total"] == 1
    assert body["average_duration_seconds"] == 2.0
    assert body["by_operation"][0]["operation_id"] == "text-to-text"

    all_jobs = _stats(client).json()
    assert all_jobs["total"] == 3
    assert all_jobs["average_duration_seconds"] == 5.0  # (2 + 8) / 2

    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    error = missing.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == missing.headers["X-Request-ID"]


def test_job_stats_rejects_malformed_project_id(client):
    response = _stats(client, project_id="not-a-uuid")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_job_stats_is_derived_live_from_the_store(client):
    project = _project(client)["id"]
    first = _stats(client).json()
    assert first["total"] == 0

    _seed_job(client, project, status="succeeded", duration_seconds=1)
    second = _stats(client).json()
    assert second["total"] == 1
    assert second["by_status"][2] == {"status": "succeeded", "count": 1}
    assert second["average_duration_seconds"] == 1.0

    client.app.state.store.clear()
    third = _stats(client).json()
    assert third["total"] == 0
    assert third["average_duration_seconds"] is None
