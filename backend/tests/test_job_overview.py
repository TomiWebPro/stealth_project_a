"""Authoritative job-overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {
    "job_id",
    "project_id",
    "project_name",
    "operation_id",
    "schema_version",
    "status",
    "progress",
    "attempt",
    "created_by",
    "created_at",
    "started_at",
    "finished_at",
    "result",
    "error",
    "counts",
    "recent_events",
    "generated_at",
}
_COUNT_KEYS = {"events", "retries", "by_event_type"}
_EVENT_TYPES = ["status", "progress", "intermediate", "result", "error", "log"]


def _overview(client, job_id, **params):
    return client.get(f"{PREFIX}/jobs/{job_id}/overview", params=params)


def _store(client):
    return client.app.state.store


def _project(client, name="Overview Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_job(
    client,
    project_id,
    **overrides,
):
    """Write a Job straight to the authoritative store with deterministic state."""
    from app.schemas.common import utcnow
    from app.schemas.operation import Job
    from app.storage.base import Collections

    now = utcnow()
    values = dict(
        id=uuid4(),
        project_id=project_id,
        operation_id="text-to-image",
        schema_version="1.0.0",
        status="running",
        progress=0.5,
        attempt=1,
        created_by=uuid4(),
        created_at=now,
    )
    values.update(overrides)
    job = Job(**values)
    _store(client).put(Collections.JOBS, str(job.id), job.model_dump(mode="json"))
    return job


def _seed_event(client, job_id, *, type="status", seq=0, created_at=None, **overrides):
    from app.schemas.common import utcnow
    from app.schemas.operation import JobEvent
    from app.storage.base import Collections

    values = dict(
        type=type,
        job_id=job_id,
        seq=seq,
        status="running",
        message="tick",
        timestamp=created_at or utcnow(),
    )
    values.update(overrides)
    event = JobEvent(**values)
    _store(client).put(
        Collections.JOB_EVENTS, f"{job_id}:{seq:012d}", event.model_dump(mode="json")
    )
    return event


def _seed_retry(client, job_id, key="idem"):
    from app.storage.base import Collections

    _store(client).put(
        Collections.JOB_RETRIES,
        f"{job_id}:{key}",
        {"job_id": str(job_id)},
    )


def _iso(base, minutes):
    return (base + timedelta(minutes=minutes)).isoformat().replace("+00:00", "Z")


def test_overview_of_fresh_job_is_zero_filled(client):
    project = _project(client, "Fresh")
    job = _seed_job(client, project["id"], status="queued", progress=0.0)

    response = _overview(client, job.id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["job_id"] == str(job.id)
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Fresh"
    assert body["operation_id"] == "text-to-image"
    assert body["schema_version"] == "1.0.0"
    assert body["status"] == "queued"
    assert body["progress"] == 0.0
    assert body["attempt"] == 1
    assert body["created_by"] == str(job.created_by)
    assert body["created_at"] == job.model_dump(mode="json")["created_at"]
    assert body["started_at"] is None
    assert body["finished_at"] is None
    assert body["result"] is None
    assert body["error"] is None
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"]["events"] == 0
    assert body["counts"]["retries"] == 0
    assert [bucket["type"] for bucket in body["counts"]["by_event_type"]] == _EVENT_TYPES
    assert all(bucket["count"] == 0 for bucket in body["counts"]["by_event_type"])
    assert body["recent_events"] == []
    assert body["generated_at"]


def test_overview_carries_terminal_state_and_result_error(client):
    from app.schemas.operation import JobError, JobResult

    project = _project(client, "Terminal")
    result = JobResult(asset_ids=[uuid4()], text="done")
    error = JobError(code="adapter_down", message="offline", retryable=True)
    job = _seed_job(
        client,
        project["id"],
        status="failed",
        progress=0.75,
        attempt=3,
        started_at="2026-01-01T00:00:00Z",
        finished_at="2026-01-01T00:05:00Z",
        result=result,
        error=error,
    )

    body = _overview(client, job.id).json()
    assert body["status"] == "failed"
    assert body["progress"] == 0.75
    assert body["attempt"] == 3
    assert body["started_at"] == "2026-01-01T00:00:00Z"
    assert body["finished_at"] == "2026-01-01T00:05:00Z"
    assert body["result"]["text"] == "done"
    assert len(body["result"]["asset_ids"]) == 1
    assert body["error"]["code"] == "adapter_down"
    assert body["error"]["retryable"] is True


def test_overview_breaks_down_event_types(client):
    project = _project(client, "Breakdown")
    job = _seed_job(client, project["id"])

    _seed_event(client, job.id, type="status", seq=0)
    _seed_event(client, job.id, type="status", seq=1)
    _seed_event(client, job.id, type="progress", seq=2)
    _seed_event(client, job.id, type="error", seq=3)

    body = _overview(client, job.id).json()
    assert body["counts"]["events"] == 4
    assert {b["type"]: b["count"] for b in body["counts"]["by_event_type"]} == {
        "status": 2,
        "progress": 1,
        "intermediate": 0,
        "result": 0,
        "error": 1,
        "log": 0,
    }


def test_overview_counts_all_events_but_bounds_recent_page(client):
    project = _project(client, "Recent")
    job = _seed_job(client, project["id"])
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)

    for index in range(4):
        _seed_event(
            client,
            job.id,
            type="log",
            seq=index,
            message=f"event-{index}",
            created_at=_iso(base, index),
        )

    full = _overview(client, job.id).json()
    assert full["counts"]["events"] == 4
    assert [item["message"] for item in full["recent_events"]] == [
        "event-3",
        "event-2",
        "event-1",
        "event-0",
    ]

    bounded = _overview(client, job.id, recent_limit=2).json()
    assert bounded["counts"]["events"] == 4  # totals not bounded by the page
    assert [item["message"] for item in bounded["recent_events"]] == ["event-3", "event-2"]


def test_overview_recent_events_use_deterministic_seq_tie_break(client):
    project = _project(client, "Ties")
    job = _seed_job(client, project["id"])
    same_time = datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")

    _seed_event(client, job.id, type="log", seq=2, message="two", created_at=same_time)
    _seed_event(client, job.id, type="log", seq=5, message="five", created_at=same_time)
    _seed_event(client, job.id, type="log", seq=1, message="one", created_at=same_time)

    body = _overview(client, job.id, recent_limit=2).json()
    assert [item["message"] for item in body["recent_events"]] == ["five", "two"]


def test_overview_ignores_orphan_events_and_counts_only_this_job(client):
    project = _project(client, "Isolation")
    job = _seed_job(client, project["id"])
    other = _seed_job(client, project["id"])

    _seed_event(client, job.id, type="status", seq=0)
    _seed_event(client, other.id, type="status", seq=0)
    _seed_event(client, uuid4(), type="status", seq=0)  # orphan: no parent job

    body = _overview(client, job.id).json()
    assert body["counts"]["events"] == 1
    assert len(body["recent_events"]) == 1
    assert body["recent_events"][0]["job_id"] == str(job.id)


def test_overview_counts_retries_and_ignores_orphans(client):
    project = _project(client, "Retries")
    job = _seed_job(client, project["id"])

    _seed_retry(client, job.id, "a")
    _seed_retry(client, job.id, "b")
    _seed_retry(client, uuid4(), "orphan")
    _store(client).put("job_retries", "malformed", {"no_job_id": True})

    body = _overview(client, job.id).json()
    assert body["counts"]["retries"] == 2


def test_overview_joins_project_name_with_orphan_fallback(client):
    project = _project(client, "Joined")
    job = _seed_job(client, project["id"])
    assert _overview(client, job.id).json()["project_name"] == "Joined"

    orphan = _seed_job(client, uuid4())  # project not in the authoritative store
    assert _overview(client, orphan.id).json()["project_name"] == "Unknown project"


def test_unknown_job_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "job_not_found"
    assert error["request_id"]


def test_malformed_job_id_uses_shared_422_envelope(client):
    response = client.get(f"{PREFIX}/jobs/not-a-uuid/overview")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    project = _project(client, "Limits")
    job = _seed_job(client, project["id"])
    for limit in (0, 51):
        response = _overview(client, job.id, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
