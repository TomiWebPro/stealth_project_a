"""Authoritative job retry feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import UUID, uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "job_id",
    "project_id",
    "project_name",
    "operation_id",
    "status",
    "attempt",
    "retries",
    "retried_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/retries/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Retry Feed Project"):
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


def _retried_job(client, project_id, *keys, operation_id="text-to-image"):
    """Seed a job retried once per key via the authoritative write path."""
    job_id = _job(client, project_id, operation_id=operation_id)["id"]
    for key in keys:
        _cancel(client, job_id)
        _retry(client, job_id, key)
    return job_id


def _latest_activity(doc):
    """Newest of a job document's created/started/finished timestamps."""
    return max(
        value
        for field in ("created_at", "started_at", "finished_at")
        if (value := doc.get(field)) is not None
    )


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["retried_at"], item["job_id"]),
        reverse=True,
    )


def test_retry_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_retry_feed_is_newest_first_with_joins_and_fields(client):
    _clear(client)
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")

    j1 = _retried_job(client, alpha["id"], "a", "b", operation_id="text-to-image")
    j2 = _retried_job(client, alpha["id"], "c", operation_id="upscale")
    j3 = _retried_job(client, beta["id"], "d", operation_id="flf2v")

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3  # one row per distinct retried job

    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)

    by_job = {item["job_id"]: item for item in items}
    assert set(by_job) == {j1, j2, j3}
    for item in items:
        assert set(item) == _ITEM_KEYS

    # Accepted-retry counts collapse onto one row per job.
    assert by_job[j1]["retries"] == 2
    assert by_job[j2]["retries"] == 1
    assert by_job[j3]["retries"] == 1

    # Project identity + display name are joined from the authoritative stores.
    assert by_job[j1]["project_id"] == alpha["id"]
    assert by_job[j1]["project_name"] == "Alpha Project"
    assert by_job[j3]["project_id"] == beta["id"]
    assert by_job[j3]["project_name"] == "Beta Project"

    # Operation/lifecycle fields come from the current job document.
    assert by_job[j1]["operation_id"] == "text-to-image"
    assert by_job[j1]["attempt"] == 3  # initial + two retries
    assert by_job[j1]["status"] == "queued"
    assert by_job[j2]["operation_id"] == "upscale"
    assert by_job[j3]["operation_id"] == "flf2v"

    # recency matches the joined job's latest activity signal.
    jobs = {str(doc["id"]): doc for doc in client.app.state.store.all(Collections.JOBS)}
    for job_id in (j1, j2, j3):
        assert by_job[job_id]["retried_at"] == _latest_activity(jobs[job_id])


def test_retry_feed_project_scope_and_unknown_project(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]
    _retried_job(client, p1, "a", "b")
    _retried_job(client, p2, "c")

    scoped = _feed(client, project_id=p1).json()
    assert scoped["total"] == 1
    assert len(scoped["items"]) == 1
    assert scoped["items"][0]["project_id"] == p1
    assert scoped["items"][0]["retries"] == 2

    other = _feed(client, project_id=p2).json()
    assert other["total"] == 1
    assert other["items"][0]["retries"] == 1

    assert _feed(client).json()["total"] == 2


def test_retry_feed_unknown_and_malformed_project_envelopes(client):
    _clear(client)

    missing = _feed(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _feed(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_retry_feed_limit_bounds_page_and_keeps_total(client):
    _clear(client)
    p = _project(client)["id"]
    for index in range(4):
        _retried_job(client, p, f"key-{index}")

    body = _feed(client).json()
    assert body["total"] == 4
    assert len(body["items"]) == 4

    paged = _feed(client, limit=2).json()
    assert paged["total"] == 4  # whole-scope total is unchanged
    assert len(paged["items"]) == 2
    assert _sorted_desc(paged["items"])

    for invalid in (0, 201):
        response = _feed(client, limit=invalid)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


def test_retry_feed_is_derived_live_and_excludes_orphans(client):
    _clear(client)
    p = _project(client)["id"]
    j = _job(client, p)["id"]

    assert _feed(client).json()["total"] == 0

    _cancel(client, j)
    _retry(client, j, "k1")
    first = _feed(client).json()
    assert first["total"] == 1
    assert first["items"][0]["job_id"] == j
    assert first["items"][0]["retries"] == 1

    # An idempotent replay does not create another row.
    _retry(client, j, "k1")
    assert _feed(client).json()["total"] == 1

    # A second distinct key increments the count on the same row.
    _cancel(client, j)
    _retry(client, j, "k2")
    second = _feed(client).json()
    assert second["total"] == 1
    assert second["items"][0]["retries"] == 2

    # A ledger entry for a deleted (unknown) job is excluded.
    store = client.app.state.store
    store.put(Collections.JOB_RETRIES, f"{uuid4()}:orphan", {"job_id": str(uuid4())})
    assert _feed(client).json()["total"] == 1

    # Removing the job removes its retries from the feed too.
    store.delete(Collections.JOBS, j)
    after = _feed(client).json()
    assert after["total"] == 0
    assert after["items"] == []


def test_retry_feed_reflects_current_job_lifecycle(client):
    _clear(client)
    p = _project(client)["id"]
    j = _retried_job(client, p, "a")

    queued = _feed(client).json()["items"][0]
    assert queued["status"] == "queued"
    assert queued["attempt"] == 2

    # A later transition is reflected live in the feed projection.
    client.app.state.repositories.jobs.start(UUID(j))
    running = _feed(client).json()["items"][0]
    assert running["status"] == "running"
    assert running["retries"] == 1
    assert running["retried_at"] == _latest_activity(
        next(doc for doc in client.app.state.store.all(Collections.JOBS) if str(doc["id"]) == j)
    )
