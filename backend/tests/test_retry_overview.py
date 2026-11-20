"""Authoritative single-retry overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "job_id",
    "project_id",
    "project_name",
    "operation_id",
    "status",
    "attempt",
    "retries",
    "retried_at",
    "counts",
    "recent_siblings",
    "generated_at",
}
_COUNT_KEYS = {"project_retries", "project_jobs", "total_retries"}
_SIBLING_KEYS = {
    "job_id",
    "project_id",
    "project_name",
    "operation_id",
    "status",
    "attempt",
    "retries",
    "retried_at",
}


def _overview(client, job_id, **params):
    return client.get(f"{PREFIX}/retries/{job_id}/overview", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Retry Overview Project"):
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
    assert response.status_code == 201, response.text
    return response.json()


def _retry(client, job_id, key):
    # Cancel first so the job is in a retryable state; the key makes the retry
    # distinct in the authoritative idempotency ledger.
    assert client.post(f"{PREFIX}/jobs/{job_id}/cancel").status_code == 200
    response = client.post(
        f"{PREFIX}/jobs/{job_id}/retry", json={"idempotency_key": key}
    )
    assert response.status_code == 200, response.text
    return response.json()


def _retried_job(client, project_id, *keys, operation_id="text-to-image"):
    """Seed one job retried once per key via the authoritative write path."""
    job_id = _job(client, project_id, operation_id=operation_id)["id"]
    for key in keys:
        _retry(client, job_id, key)
    return job_id


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["retried_at"], item["job_id"]),
        reverse=True,
    )


def test_overview_of_single_retried_job(client):
    _clear(client)
    project = _project(client, "Single")
    job_id = _retried_job(client, project["id"], "a", "b")
    job = next(
        doc for doc in client.app.state.store.all(Collections.JOBS) if str(doc["id"]) == job_id
    )

    response = _overview(client, job_id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["job_id"] == job_id
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Single"
    assert body["operation_id"] == "text-to-image"
    assert body["status"] == "queued"
    assert body["attempt"] == 3  # initial + two retries
    assert body["retries"] == 2
    assert body["retried_at"] == max(
        value
        for field in ("created_at", "started_at", "finished_at")
        if (value := job.get(field)) is not None
    )
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {
        "project_retries": 2,
        "project_jobs": 1,
        "total_retries": 2,
    }
    assert len(body["recent_siblings"]) == 1
    assert set(body["recent_siblings"][0]) == _SIBLING_KEYS
    assert body["recent_siblings"][0]["job_id"] == job_id
    assert body["recent_siblings"][0]["retries"] == 2
    assert body["generated_at"]


def test_overview_counts_are_whole_scope_and_siblings_bounded(client):
    _clear(client)
    alpha = _project(client, "Alpha")["id"]
    beta = _project(client, "Beta")["id"]
    j1 = _retried_job(client, alpha, "a", "b")
    j2 = _retried_job(client, alpha, "c")
    _retried_job(client, beta, "d")

    full = _overview(client, j1).json()
    assert full["counts"] == {
        "project_retries": 3,  # j1 (2) + j2 (1)
        "project_jobs": 2,
        "total_retries": 4,  # + beta's 1
    }
    assert {item["job_id"] for item in full["recent_siblings"]} == {j1, j2}
    assert _sorted_desc(full["recent_siblings"])

    bounded = _overview(client, j1, recent_limit=1).json()
    assert bounded["counts"] == full["counts"]  # counts never bounded by the page
    assert len(bounded["recent_siblings"]) == 1
    assert bounded["recent_siblings"] == full["recent_siblings"][:1]
    assert {item["job_id"] for item in bounded["recent_siblings"]} <= {j1, j2}


def test_overview_agrees_with_retry_stats_and_feed(client):
    _clear(client)
    alpha = _project(client, "Alpha")["id"]
    beta = _project(client, "Beta")["id"]
    j1 = _retried_job(client, alpha, "a", "b")
    _retried_job(client, alpha, "c")
    _retried_job(client, beta, "d")

    stats = client.get(f"{PREFIX}/retries/stats").json()
    feed = client.get(f"{PREFIX}/retries/feed", params={"limit": 200}).json()
    overview = _overview(client, j1).json()

    assert overview["counts"]["total_retries"] == stats["total_retries"]
    assert overview["counts"]["total_retries"] == sum(item["retries"] for item in feed["items"])
    alpha_feed = [item for item in feed["items"] if item["project_id"] == alpha]
    assert overview["counts"]["project_jobs"] == len(alpha_feed)
    assert overview["counts"]["project_retries"] == sum(item["retries"] for item in alpha_feed)

    target = next(item for item in feed["items"] if item["job_id"] == j1)
    assert overview["retries"] == target["retries"]
    assert overview["retried_at"] == target["retried_at"]
    assert overview["status"] == target["status"]
    assert overview["attempt"] == target["attempt"]


def test_overview_joins_project_name_with_orphan_fallback(client):
    _clear(client)
    project = _project(client, "Joined")
    job_id = _retried_job(client, project["id"], "a")

    assert _overview(client, job_id).json()["project_name"] == "Joined"

    client.app.state.store.delete(Collections.PROJECTS, project["id"])
    body = _overview(client, job_id).json()
    assert body["project_name"] == "Unknown project"
    assert body["counts"]["project_jobs"] == 1  # still attributed via job.project_id


def test_overview_excludes_orphan_ledger_entries(client):
    _clear(client)
    project_id = _project(client)["id"]
    job_id = _retried_job(client, project_id, "a")

    # A ledger entry whose job is missing cannot inflate any count.
    client.app.state.store.put(
        Collections.JOB_RETRIES, f"{uuid4()}:orphan", {"job_id": str(uuid4())}
    )
    body = _overview(client, job_id).json()
    assert body["retries"] == 1
    assert body["counts"] == {
        "project_retries": 1,
        "project_jobs": 1,
        "total_retries": 1,
    }
    assert [item["job_id"] for item in body["recent_siblings"]] == [job_id]


def test_overview_removing_job_yields_job_not_found(client):
    _clear(client)
    project_id = _project(client)["id"]
    job_id = _retried_job(client, project_id, "a")

    client.app.state.store.delete(Collections.JOBS, job_id)
    response = _overview(client, job_id)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "job_not_found"


def test_unknown_job_uses_shared_404_envelope(client):
    _clear(client)
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "job_not_found"
    assert error["request_id"]


def test_job_without_retries_uses_retry_not_found_envelope(client):
    _clear(client)
    project_id = _project(client)["id"]
    job_id = _job(client, project_id)["id"]  # submitted but never retried

    response = _overview(client, job_id)
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "retry_not_found"
    assert error["request_id"]


def test_malformed_job_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _overview(client, "not-a-uuid")
    assert response.status_code == 422
    assert response.headers["X-Request-ID"]
    assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    _clear(client)
    project_id = _project(client)["id"]
    job_id = _retried_job(client, project_id, "a")

    for limit in (0, 51):
        response = _overview(client, job_id, recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
