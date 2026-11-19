"""Authoritative job event stream statistics endpoint tests (success + failure)."""

from __future__ import annotations

from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "total_events",
    "total_jobs",
    "by_type",
    "by_job",
    "newest_event_at",
    "generated_at",
}

_TYPES = ["status", "progress", "intermediate", "result", "error", "log"]


def _stats(client, **params):
    return client.get(f"{PREFIX}/events/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Event Stats Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _job(client, project_id, operation_id="text-to-image"):
    response = client.post(
        f"{PREFIX}/jobs",
        json={
            "operation_id": operation_id,
            "schema_version": "1.0.0",
            "project_id": project_id,
        },
    )
    assert response.status_code == 201
    return response.json()


def _clear_events(client):
    """Remove auto-emitted submit events so seeded counts are deterministic."""
    store = client.app.state.store
    for doc in list(store.all(Collections.JOB_EVENTS)):
        store.delete(Collections.JOB_EVENTS, f"{doc['job_id']}:{doc['seq']:012d}")


def _append(client, job_id, event_type):
    """Emit an event through the same authoritative write path jobs use."""
    return client.app.state.repositories.jobs.append_event(job_id, event_type)


def test_event_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_events"] == 0
    assert body["total_jobs"] == 0
    assert body["by_type"] == [{"type": t, "count": 0} for t in _TYPES]
    assert body["by_job"] == []
    assert body["newest_event_at"] is None
    assert body["generated_at"]


def test_event_stats_derives_type_job_breakdown_and_recency(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    j1 = _job(client, p1)["id"]
    j2 = _job(client, p1)["id"]
    _clear_events(client)

    # j1: two progress events + one result; j2: one status + one error.
    _append(client, j1, "progress")
    _append(client, j1, "progress")
    _append(client, j1, "result")
    _append(client, j2, "status")
    _append(client, j2, "error")

    body = _stats(client).json()
    assert body["total_events"] == 5
    assert body["total_jobs"] == 2

    by_type = {entry["type"]: entry["count"] for entry in body["by_type"]}
    assert [entry["type"] for entry in body["by_type"]] == _TYPES
    assert by_type == {
        "status": 1,
        "progress": 2,
        "intermediate": 0,
        "result": 1,
        "error": 1,
        "log": 0,
    }

    # by_job: j1 has 3 events, j2 has 2 -> descending count then id.
    assert [entry["job_id"] for entry in body["by_job"]] == [j1, j2]
    assert body["by_job"][0]["events"] == 3
    assert body["by_job"][1]["events"] == 2
    assert body["by_job"][0]["newest_event_at"]

    # Recency is the newest event timestamp in the authoritative store.
    expected_newest = max(
        doc["timestamp"] for doc in client.app.state.store.all(Collections.JOB_EVENTS)
    )
    assert body["newest_event_at"] == expected_newest


def test_event_stats_project_scope_joins_events_to_jobs(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]
    j1 = _job(client, p1)["id"]
    j2 = _job(client, p2)["id"]
    _clear_events(client)

    _append(client, j1, "progress")
    _append(client, j1, "status")
    _append(client, j2, "log")

    scoped = _stats(client, project_id=p1).json()
    assert scoped["total_events"] == 2
    assert scoped["total_jobs"] == 1
    assert [entry["job_id"] for entry in scoped["by_job"]] == [j1]
    scoped_types = {e["type"]: e["count"] for e in scoped["by_type"]}
    assert scoped_types["progress"] == 1
    assert scoped_types["status"] == 1
    assert scoped_types["log"] == 0

    global_body = _stats(client).json()
    assert global_body["total_events"] == 3
    assert global_body["total_jobs"] == 2

    # Orphan events (job deleted but events retained) are excluded from scope,
    # but still counted workspace-wide (which needs no job join).
    client.app.state.store.delete(Collections.JOBS, j2)
    scoped_after = _stats(client, project_id=p2).json()
    assert scoped_after["total_events"] == 0
    global_after = _stats(client).json()
    assert global_after["total_events"] == 3


def test_event_stats_unknown_and_malformed_project(client):
    _clear(client)

    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _stats(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_event_stats_is_derived_live_from_the_store(client):
    _clear(client)
    p = _project(client)["id"]
    j = _job(client, p)["id"]
    _clear_events(client)

    before = _stats(client).json()
    assert before["total_events"] == 0

    _append(client, j, "status")
    after_status = _stats(client).json()
    assert after_status["total_events"] == 1
    assert after_status["total_jobs"] == 1
    assert {e["type"]: e["count"] for e in after_status["by_type"]}["status"] == 1

    _append(client, j, "error")
    after_error = _stats(client).json()
    assert after_error["total_events"] == 2
    assert {e["type"]: e["count"] for e in after_error["by_type"]}["error"] == 1

    client.app.state.store.delete(Collections.JOB_EVENTS, f"{j}:000000000000")
    after_delete = _stats(client).json()
    assert after_delete["total_events"] == 1
