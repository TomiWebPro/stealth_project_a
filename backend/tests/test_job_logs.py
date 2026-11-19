"""Authoritative per-job execution log endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {"job_id", "entries", "next_seq", "total"}


def _logs(client, job_id, **params):
    return client.get(f"{PREFIX}/jobs/{job_id}/logs", params=params)


def _clear(client):
    client.app.state.store.clear()


def _job(client):
    project = client.post(f"{PREFIX}/projects", json={"name": "Log Project"})
    assert project.status_code == 201
    submitted = client.post(
        f"{PREFIX}/jobs",
        json={
            "operation_id": "text-to-image",
            "schema_version": "1.0.0",
            "project_id": project.json()["id"],
            "prompt": "a log test",
        },
    )
    assert submitted.status_code == 201
    return submitted.json()["id"]


def _append(client, job_id, event_type, **kwargs):
    return client.app.state.repositories.jobs.append_event(job_id, event_type, **kwargs)


def test_job_logs_derives_chronological_entries_levels_and_total(client):
    _clear(client)
    job_id = _job(client)  # submit() already appended the "Job queued." status event
    _append(client, job_id, "log", message="Loading weights")
    _append(client, job_id, "progress", progress=0.5, message="Halfway")
    _append(client, job_id, "error", message="boom")

    response = _logs(client, job_id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["job_id"] == job_id
    assert body["total"] == 4
    assert [entry["seq"] for entry in body["entries"]] == [0, 1, 2, 3]
    assert [entry["level"] for entry in body["entries"]] == [
        "info",  # status
        "info",  # log
        "debug",  # progress
        "error",  # error
    ]
    assert body["entries"][0]["type"] == "status"
    assert body["entries"][1]["message"] == "Loading weights"
    assert body["entries"][2]["progress"] == 0.5
    assert body["entries"][3]["message"] == "boom"
    assert body["next_seq"] == 4


def test_job_logs_result_event_maps_to_success_level(client):
    _clear(client)
    job_id = _job(client)
    _append(client, job_id, "result", message="done")

    body = _logs(client, job_id).json()
    assert body["entries"][-1]["level"] == "success"
    assert body["entries"][-1]["type"] == "result"


def test_job_logs_level_filter_narrows_entries_and_total(client):
    _clear(client)
    job_id = _job(client)
    _append(client, job_id, "log", message="one")
    _append(client, job_id, "error", message="bad")
    _append(client, job_id, "progress", progress=0.3)
    _append(client, job_id, "error", message="worse")

    body = _logs(client, job_id, level="error").json()
    assert body["total"] == 2
    assert [entry["message"] for entry in body["entries"]] == ["bad", "worse"]
    assert all(entry["level"] == "error" for entry in body["entries"])

    debug = _logs(client, job_id, level="debug").json()
    assert debug["total"] == 1
    assert debug["entries"][0]["type"] == "progress"


def test_job_logs_pagination_resume_cursor_does_not_overlap(client):
    _clear(client)
    job_id = _job(client)
    for index in range(5):
        _append(client, job_id, "log", message=f"line-{index}")

    first = _logs(client, job_id, limit=2).json()
    assert first["total"] == 6
    assert [entry["seq"] for entry in first["entries"]] == [0, 1]
    assert first["next_seq"] == 2

    second = _logs(client, job_id, since_seq=first["next_seq"], limit=2).json()
    assert second["total"] == 6  # total ignores the cursor
    assert [entry["seq"] for entry in second["entries"]] == [2, 3]
    assert second["next_seq"] == 4

    third = _logs(client, job_id, since_seq=second["next_seq"], limit=2).json()
    assert [entry["seq"] for entry in third["entries"]] == [4, 5]
    assert third["next_seq"] == 6

    exhausted = _logs(client, job_id, since_seq=third["next_seq"], limit=2).json()
    assert exhausted["entries"] == []
    assert exhausted["next_seq"] == 6


def test_job_logs_empty_stream_is_empty_with_cursor_at_since(client):
    _clear(client)
    job_id = _job(client)
    store = client.app.state.store
    for event in client.app.state.repositories.jobs.event_frame(job_id).events:
        store.delete(Collections.JOB_EVENTS, f"{job_id}:{event.seq:012d}")

    body = _logs(client, job_id).json()
    assert body["entries"] == []
    assert body["total"] == 0
    assert body["next_seq"] == 0

    paged = _logs(client, job_id, since_seq=7).json()
    assert paged["entries"] == []
    assert paged["next_seq"] == 7


def test_job_logs_unknown_job_uses_shared_404_envelope(client):
    _clear(client)
    response = _logs(client, uuid4())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "job_not_found"
    assert response.headers["X-Request-ID"]


def test_job_logs_malformed_job_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _logs(client, "not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_job_logs_invalid_filters_use_shared_422_envelope(client):
    _clear(client)
    job_id = _job(client)

    bad_level = _logs(client, job_id, level="verbose")
    assert bad_level.status_code == 422
    assert bad_level.json()["error"]["code"] == "validation_error"

    negative = _logs(client, job_id, since_seq=-1)
    assert negative.status_code == 422
    assert negative.json()["error"]["code"] == "validation_error"

    for bad_limit in (0, 201):
        response = _logs(client, job_id, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
