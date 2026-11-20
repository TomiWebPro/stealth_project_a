"""Authoritative single job-event overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "job_id",
    "seq",
    "type",
    "operation_id",
    "project_id",
    "project_name",
    "status",
    "progress",
    "message",
    "asset_id",
    "error",
    "timestamp",
    "counts",
    "recent_siblings",
    "generated_at",
}
_COUNT_KEYS = {"total", "by_type"}
_TYPES = ["status", "progress", "intermediate", "result", "error", "log"]


def _overview(client, job_id, seq, **params):
    return client.get(f"{PREFIX}/jobs/{job_id}/events/{seq}/overview", params=params)


def _store(client):
    return client.app.state.store


def _project(client, name="Event Overview Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _job(client, project_id, *, operation_id="text-to-image"):
    response = client.post(
        f"{PREFIX}/jobs",
        json={
            "operation_id": operation_id,
            "schema_version": "1.0.0",
            "project_id": project_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _clear_events(client):
    """Remove auto-emitted submit events so seeded counts are deterministic."""
    store = _store(client)
    for doc in list(store.all(Collections.JOB_EVENTS)):
        store.delete(Collections.JOB_EVENTS, f"{doc['job_id']}:{doc['seq']:012d}")


def _put_event(client, job_id, seq, event_type, *, timestamp=None, **fields):
    """Seed a fully-populated event directly into the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.operation import JobEvent

    event = JobEvent(
        type=event_type,
        job_id=job_id,
        seq=seq,
        timestamp=timestamp or utcnow(),
        **fields,
    )
    _store(client).put(
        Collections.JOB_EVENTS,
        f"{job_id}:{seq:012d}",
        event.model_dump(mode="json"),
    )
    return event


def _seed_orphan_job(client):
    """A job whose project is absent, to exercise the name fallback."""
    from app.schemas.common import utcnow
    from app.schemas.operation import Job

    job = Job(
        id=uuid4(),
        project_id=uuid4(),
        operation_id="text-to-image",
        schema_version="1.0.0",
        status="queued",
        created_by=uuid4(),
        created_at=utcnow(),
    )
    _store(client).put(Collections.JOBS, str(job.id), job.model_dump(mode="json"))
    return job


def test_overview_of_single_event(client):
    project = _project(client, "Single")
    job = _job(client, project["id"])
    _clear_events(client)
    timestamp = datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    target = _put_event(
        client,
        job["id"],
        0,
        "status",
        status="running",
        message="started",
        timestamp=timestamp,
    )

    response = _overview(client, job["id"], target.seq)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["job_id"] == job["id"]
    assert body["seq"] == 0
    assert body["type"] == "status"
    assert body["operation_id"] == "text-to-image"
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Single"
    assert body["status"] == "running"
    assert body["message"] == "started"
    assert body["timestamp"] == timestamp
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"]["total"] == 1
    assert [bucket["type"] for bucket in body["counts"]["by_type"]] == _TYPES
    assert len(body["recent_siblings"]) == 1
    assert body["recent_siblings"][0]["seq"] == 0
    assert body["generated_at"]


def test_overview_breaks_down_event_types_zero_filled(client):
    project = _project(client, "Breakdown")
    job = _job(client, project["id"], operation_id="lora-train")
    _clear_events(client)
    _put_event(client, job["id"], 0, "status")
    _put_event(client, job["id"], 1, "progress")
    _put_event(client, job["id"], 2, "progress")
    _put_event(client, job["id"], 3, "error")

    body = _overview(client, job["id"], 1).json()
    assert body["counts"]["total"] == 4
    assert {bucket["type"]: bucket["count"] for bucket in body["counts"]["by_type"]} == {
        "status": 1,
        "progress": 2,
        "intermediate": 0,
        "result": 0,
        "error": 1,
        "log": 0,
    }


def test_overview_recent_siblings_newest_first_and_bounded(client):
    project = _project(client, "Siblings")
    job = _job(client, project["id"])
    _clear_events(client)
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for index in range(4):
        _put_event(
            client,
            job["id"],
            index,
            "log",
            message=f"event-{index}",
            timestamp=(base + timedelta(minutes=index)).isoformat().replace("+00:00", "Z"),
        )

    full = _overview(client, job["id"], 0).json()
    assert [item["message"] for item in full["recent_siblings"]] == [
        "event-3",
        "event-2",
        "event-1",
        "event-0",
    ]

    bounded = _overview(client, job["id"], 0, recent_limit=2).json()
    assert bounded["counts"]["total"] == 4  # count not bounded by the page
    assert [item["message"] for item in bounded["recent_siblings"]] == [
        "event-3",
        "event-2",
    ]


def test_overview_siblings_use_deterministic_seq_tie_break(client):
    project = _project(client, "Ties")
    job = _job(client, project["id"])
    _clear_events(client)
    same_time = datetime(2026, 1, 1, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    _put_event(client, job["id"], 0, "log", timestamp=same_time)
    _put_event(client, job["id"], 1, "log", timestamp=same_time)

    body = _overview(client, job["id"], 0).json()
    assert [item["seq"] for item in body["recent_siblings"]] == [1, 0]


def test_overview_is_scoped_to_one_job(client):
    project = _project(client, "Scoped")
    first = _job(client, project["id"])
    second = _job(client, project["id"])
    _clear_events(client)
    mine = _put_event(client, first["id"], 0, "status")
    _put_event(client, first["id"], 1, "progress")
    _put_event(client, second["id"], 99, "result")

    body = _overview(client, first["id"], mine.seq).json()
    assert body["counts"]["total"] == 2
    assert {item["seq"] for item in body["recent_siblings"]} == {0, 1}

    # A real event sequence from a different job is not visible on this path.
    response = _overview(client, first["id"], 99)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "event_not_found"


def test_overview_propagates_optional_event_fields(client):
    project = _project(client, "Fields")
    job = _job(client, project["id"])
    _clear_events(client)
    asset_id = uuid4()
    error = {"code": "worker_offline", "message": "retry later", "retryable": True}
    _put_event(
        client,
        job["id"],
        0,
        "error",
        status="failed",
        progress=0.5,
        message="boom",
        asset_id=asset_id,
        error=error,
    )

    body = _overview(client, job["id"], 0).json()
    assert body["status"] == "failed"
    assert body["progress"] == 0.5
    assert body["message"] == "boom"
    assert body["asset_id"] == str(asset_id)
    assert body["error"] == error


def test_overview_joins_project_name_with_orphan_fallback(client):
    project = _project(client, "Joined")
    job = _job(client, project["id"])
    _clear_events(client)
    _put_event(client, job["id"], 0, "status")
    assert _overview(client, job["id"], 0).json()["project_name"] == "Joined"

    orphan = _seed_orphan_job(client)
    _put_event(client, orphan.id, 0, "status")
    assert _overview(client, orphan.id, 0).json()["project_name"] == "Unknown project"


def test_unknown_job_uses_shared_404_envelope(client):
    response = _overview(client, uuid4(), 0)
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "job_not_found"
    assert error["request_id"]


def test_unknown_event_uses_shared_404_envelope(client):
    project = _project(client, "Missing event")
    job = _job(client, project["id"])
    _clear_events(client)
    response = _overview(client, job["id"], 42)
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "event_not_found"
    assert error["request_id"]


def test_malformed_ids_and_seq_use_shared_422_envelope(client):
    response = _overview(client, "not-a-uuid", 0)
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"

    response = _overview(client, uuid4(), -1)
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    project = _project(client, "Limits")
    job = _job(client, project["id"])
    _clear_events(client)
    _put_event(client, job["id"], 0, "status")
    for limit in (0, 51):
        response = _overview(client, job["id"], 0, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
