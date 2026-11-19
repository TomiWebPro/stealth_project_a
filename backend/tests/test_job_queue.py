"""Authoritative job dispatch-queue endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from app.schemas.operation import JobResult

from .conftest import PREFIX

_KEYS = {"total", "waiting", "running", "entries", "generated_at"}


def _queue(client, **params):
    return client.get(f"{PREFIX}/jobs/queue", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Queue Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def _submit(client, project_id, prompt="queue test"):
    response = client.post(
        f"{PREFIX}/jobs",
        json={
            "operation_id": "text-to-image",
            "schema_version": "1.0.0",
            "project_id": project_id,
            "prompt": prompt,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_job_queue_orders_active_jobs_fifo_with_positions_and_counts(client):
    _clear(client)
    project_id = _project(client)
    first = _submit(client, project_id)
    second = _submit(client, project_id)
    third = _submit(client, project_id)

    # Move the middle job to running; terminal jobs are excluded from the queue.
    client.app.state.repositories.jobs.start(second)

    response = _queue(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    assert body["waiting"] == 2
    assert body["running"] == 1
    assert [entry["position"] for entry in body["entries"]] == [1, 2, 3]
    assert [entry["job_id"] for entry in body["entries"]] == [first, second, third]
    assert [entry["status"] for entry in body["entries"]] == [
        "queued",
        "running",
        "queued",
    ]
    assert all(entry["project_id"] == project_id for entry in body["entries"])
    assert all(entry["operation_id"] == "text-to-image" for entry in body["entries"])
    assert all(entry["created_at"] for entry in body["entries"])


def test_job_queue_excludes_terminal_jobs(client):
    _clear(client)
    project_id = _project(client)
    queued = _submit(client, project_id)
    running = _submit(client, project_id)
    succeeded = _submit(client, project_id)
    canceled = _submit(client, project_id)

    jobs = client.app.state.repositories.jobs
    jobs.start(running)
    jobs.start(succeeded)
    jobs.complete(succeeded, JobResult())
    jobs.cancel(canceled)

    body = _queue(client).json()
    assert body["total"] == 2
    assert body["waiting"] == 1
    assert body["running"] == 1
    assert [entry["job_id"] for entry in body["entries"]] == [queued, running]


def test_job_queue_project_scope_narrows_derivation(client):
    _clear(client)
    project_a = _project(client, "Queue A")
    project_b = _project(client, "Queue B")
    a_job = _submit(client, project_a)
    _submit(client, project_b)

    scoped = _queue(client, project_id=project_a).json()
    assert scoped["total"] == 1
    assert scoped["waiting"] == 1
    assert [entry["job_id"] for entry in scoped["entries"]] == [a_job]

    # Whole workspace still sees both jobs.
    assert _queue(client).json()["total"] == 2


def test_job_queue_limit_bounds_the_page_but_not_the_counters(client):
    _clear(client)
    project_id = _project(client)
    job_ids = [_submit(client, project_id) for _ in range(4)]

    body = _queue(client, limit=2).json()
    assert body["total"] == 4
    assert body["waiting"] == 4
    assert [entry["job_id"] for entry in body["entries"]] == job_ids[:2]
    assert [entry["position"] for entry in body["entries"]] == [1, 2]


def test_job_queue_empty_store_returns_zeroed_view(client):
    _clear(client)
    body = _queue(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["waiting"] == 0
    assert body["running"] == 0
    assert body["entries"] == []
    assert body["generated_at"]


def test_job_queue_unknown_project_uses_shared_404_envelope(client):
    _clear(client)
    response = _queue(client, project_id=uuid4())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"
    assert response.headers["X-Request-ID"]


def test_job_queue_malformed_project_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _queue(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_job_queue_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _queue(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
