"""Authoritative job retry statistics endpoint tests (success + failure)."""

from __future__ import annotations

from uuid import UUID, uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "total_retries",
    "total_jobs",
    "by_status",
    "by_project",
    "newest_retry_at",
    "generated_at",
}

_STATUSES = ["queued", "running", "succeeded", "failed", "canceled"]


def _stats(client, **params):
    return client.get(f"{PREFIX}/retries/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Retry Stats Project"):
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


def _cancel(client, job_id):
    response = client.post(f"{PREFIX}/jobs/{job_id}/cancel")
    assert response.status_code == 200
    return response.json()


def _retry(client, job_id, key):
    response = client.post(
        f"{PREFIX}/jobs/{job_id}/retry",
        json={"idempotency_key": key},
    )
    assert response.status_code == 200
    return response.json()


def _retried_job(client, project_id, *keys):
    """Seed a job retried once per key via the authoritative write path."""
    job_id = _job(client, project_id)["id"]
    for key in keys:
        _cancel(client, job_id)  # queued/canceled -> canceled (retryable)
        _retry(client, job_id, key)
    return job_id


def _latest_activity(doc):
    """Newest of a job document's created/started/finished timestamps."""
    return max(
        value
        for field in ("created_at", "started_at", "finished_at")
        if (value := doc.get(field)) is not None
    )


def test_retry_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_retries"] == 0
    assert body["total_jobs"] == 0
    assert body["by_status"] == [{"status": s, "jobs": 0} for s in _STATUSES]
    assert body["by_project"] == []
    assert body["newest_retry_at"] is None
    assert body["generated_at"]


def test_retry_stats_derives_totals_status_and_project_breakdown(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    j1 = _retried_job(client, p1, "a", "b")  # 2 retries
    j2 = _retried_job(client, p1, "c")  # 1 retry
    j3 = _retried_job(client, p2, "d")  # 1 retry

    # Idempotency replay must not create another ledger entry or change state.
    replayed = _retry(client, j1, "a")
    assert replayed["status"] == "queued"

    # Vary current status so the zero-filled status buckets are exercised.
    _cancel(client, j2)  # -> canceled
    client.app.state.repositories.jobs.start(UUID(j3))  # -> running

    body = _stats(client).json()
    assert body["total_retries"] == 4
    assert body["total_jobs"] == 3

    assert [entry["status"] for entry in body["by_status"]] == _STATUSES
    by_status = {entry["status"]: entry["jobs"] for entry in body["by_status"]}
    assert by_status == {
        "queued": 1,  # j1
        "running": 1,  # j3
        "succeeded": 0,
        "failed": 0,
        "canceled": 1,  # j2
    }

    assert [entry["project_id"] for entry in body["by_project"]] == [p1, p2]
    assert body["by_project"][0]["retries"] == 3
    assert body["by_project"][0]["jobs"] == 2
    assert body["by_project"][1]["retries"] == 1
    assert body["by_project"][1]["jobs"] == 1

    # Recency is the newest activity timestamp among the joined retried jobs.
    jobs = {str(doc["id"]): doc for doc in client.app.state.store.all(Collections.JOBS)}
    expected_newest = max(_latest_activity(jobs[j]) for j in (j1, j2, j3))
    assert body["newest_retry_at"] == expected_newest


def test_retry_stats_project_scope_joins_retries_to_jobs(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]
    _retried_job(client, p1, "a", "b")
    _retried_job(client, p2, "c")

    scoped = _stats(client, project_id=p1).json()
    assert scoped["total_retries"] == 2
    assert scoped["total_jobs"] == 1
    assert [entry["project_id"] for entry in scoped["by_project"]] == [p1]
    assert {e["status"]: e["jobs"] for e in scoped["by_status"]}["queued"] == 1
    assert {e["status"]: e["jobs"] for e in scoped["by_status"]}["running"] == 0

    other = _stats(client, project_id=p2).json()
    assert other["total_retries"] == 1
    assert other["total_jobs"] == 1

    global_body = _stats(client).json()
    assert global_body["total_retries"] == 3
    assert global_body["total_jobs"] == 2


def test_retry_stats_unknown_and_malformed_project(client):
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


def test_retry_stats_is_derived_live_and_excludes_orphans(client):
    _clear(client)
    p = _project(client)["id"]
    j = _job(client, p)["id"]

    assert _stats(client).json()["total_retries"] == 0

    _cancel(client, j)
    _retry(client, j, "k1")
    first = _stats(client).json()
    assert first["total_retries"] == 1
    assert first["total_jobs"] == 1
    assert {e["status"]: e["jobs"] for e in first["by_status"]}["queued"] == 1

    _cancel(client, j)
    _retry(client, j, "k2")
    second = _stats(client).json()
    assert second["total_retries"] == 2
    assert second["total_jobs"] == 1

    # A ledger entry for a deleted (unknown) job cannot be attributed and is
    # excluded from every view, keeping totals consistent with by_project.
    store = client.app.state.store
    store.put(Collections.JOB_RETRIES, f"{uuid4()}:orphan", {"job_id": str(uuid4())})
    with_orphan = _stats(client).json()
    assert with_orphan["total_retries"] == 2
    assert sum(e["retries"] for e in with_orphan["by_project"]) == 2

    # Removing the job removes its retries from the snapshot too.
    store.delete(Collections.JOBS, j)
    after = _stats(client).json()
    assert after["total_retries"] == 0
    assert after["total_jobs"] == 0
    assert after["newest_retry_at"] is None
