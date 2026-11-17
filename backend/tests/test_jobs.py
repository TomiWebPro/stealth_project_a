"""Operations catalog and job lifecycle endpoint tests."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

T2I = {"operation_id": "text-to-image", "schema_version": "1.0.0"}


def _project(client, name="Job Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _submit(client, project_id, **overrides):
    payload = {**T2I, "project_id": project_id, **overrides}
    return client.post(f"{PREFIX}/jobs", json=payload)


# --- Catalog ----------------------------------------------------------------


def test_get_operations_catalog(client):
    response = client.get(f"{PREFIX}/operations")
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "1.0.0"
    ids = [operation["id"] for operation in body["operations"]]
    assert "text-to-image" in ids
    assert "lora-train" in ids


def test_get_operation_spec(client):
    response = client.get(f"{PREFIX}/operations/text-to-image")
    assert response.status_code == 200
    spec = response.json()
    assert spec["id"] == "text-to-image"
    assert spec["schema_version"] == "1.0.0"


def test_get_unknown_operation_spec(client):
    response = client.get(f"{PREFIX}/operations/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "operation_not_found"


# --- Submit -----------------------------------------------------------------


def test_submit_job_success(client, settings):
    project = _project(client)
    response = _submit(client, project["id"], prompt="a red fox")
    assert response.status_code == 201
    job = response.json()
    assert job["operation_id"] == "text-to-image"
    assert job["project_id"] == project["id"]
    assert job["status"] == "queued"
    assert job["progress"] == 0.0
    assert job["attempt"] == 1
    assert job["created_by"] == str(settings.default_user_id)
    assert job["started_at"] is None and job["finished_at"] is None


def test_submit_unknown_operation(client):
    project = _project(client)
    response = _submit(client, project["id"], operation_id="no-such-op")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_operation"


def test_submit_schema_version_mismatch(client):
    project = _project(client)
    response = _submit(client, project["id"], schema_version="9.9.9")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "schema_version_mismatch"


def test_submit_missing_project(client):
    response = _submit(client, str(uuid4()))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


def test_submit_to_archived_project(client):
    project = _project(client)
    assert client.delete(f"{PREFIX}/projects/{project['id']}").status_code == 204
    response = _submit(client, project["id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "project_archived"


# --- Read / list ------------------------------------------------------------


def test_get_job_success_and_missing(client):
    project = _project(client)
    job_id = _submit(client, project["id"]).json()["id"]
    assert client.get(f"{PREFIX}/jobs/{job_id}").json()["id"] == job_id
    missing = client.get(f"{PREFIX}/jobs/{uuid4()}")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "job_not_found"


def test_list_jobs_filters(client):
    p1 = _project(client, "One")["id"]
    p2 = _project(client, "Two")["id"]
    _submit(client, p1)
    _submit(client, p1)
    _submit(client, p2)

    assert len(client.get(f"{PREFIX}/jobs").json()) == 3
    assert len(client.get(f"{PREFIX}/jobs", params={"project_id": p1}).json()) == 2
    assert len(client.get(f"{PREFIX}/jobs", params={"status": "queued"}).json()) == 3
    assert len(client.get(f"{PREFIX}/jobs", params={"status": "failed"}).json()) == 0
    assert len(client.get(f"{PREFIX}/jobs", params={"limit": 1}).json()) == 1


# --- Events -----------------------------------------------------------------


def test_job_events_stream_and_resume(client):
    project = _project(client)
    job_id = _submit(client, project["id"]).json()["id"]

    frame = client.get(f"{PREFIX}/jobs/{job_id}/events").json()
    assert frame["job_id"] == job_id
    assert [event["seq"] for event in frame["events"]] == [0]
    assert frame["events"][0]["type"] == "status"
    assert frame["events"][0]["status"] == "queued"
    assert frame["next_seq"] == 1

    resumed = client.get(
        f"{PREFIX}/jobs/{job_id}/events", params={"since": 1}
    ).json()
    assert resumed["events"] == []
    assert resumed["next_seq"] == 1


def test_job_events_missing_job(client):
    response = client.get(f"{PREFIX}/jobs/{uuid4()}/events")
    assert response.status_code == 404


# --- Cancel -----------------------------------------------------------------


def test_cancel_job(client):
    project = _project(client)
    job_id = _submit(client, project["id"]).json()["id"]
    response = client.post(
        f"{PREFIX}/jobs/{job_id}/cancel", json={"reason": "user requested"}
    )
    assert response.status_code == 200
    job = response.json()
    assert job["status"] == "canceled"
    assert job["finished_at"] is not None

    events = client.get(f"{PREFIX}/jobs/{job_id}/events").json()["events"]
    assert [event["seq"] for event in events] == [0, 1]
    assert events[1]["status"] == "canceled"
    assert events[1]["message"] == "user requested"


def test_cancel_with_empty_body(client):
    project = _project(client)
    job_id = _submit(client, project["id"]).json()["id"]
    assert client.post(f"{PREFIX}/jobs/{job_id}/cancel").status_code == 200


def test_cancel_terminal_job_conflict(client):
    project = _project(client)
    job_id = _submit(client, project["id"]).json()["id"]
    client.post(f"{PREFIX}/jobs/{job_id}/cancel")
    response = client.post(f"{PREFIX}/jobs/{job_id}/cancel")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "job_not_cancelable"


def test_cancel_missing_job(client):
    response = client.post(f"{PREFIX}/jobs/{uuid4()}/cancel")
    assert response.status_code == 404


# --- Retry ------------------------------------------------------------------


def test_retry_canceled_job(client):
    project = _project(client)
    job_id = _submit(client, project["id"]).json()["id"]
    client.post(f"{PREFIX}/jobs/{job_id}/cancel")

    response = client.post(
        f"{PREFIX}/jobs/{job_id}/retry", json={"idempotency_key": "retry-1"}
    )
    assert response.status_code == 200
    job = response.json()
    assert job["status"] == "queued"
    assert job["attempt"] == 2
    assert job["progress"] == 0.0
    assert job["finished_at"] is None


def test_retry_queue_job_conflict(client):
    project = _project(client)
    job_id = _submit(client, project["id"]).json()["id"]
    response = client.post(
        f"{PREFIX}/jobs/{job_id}/retry", json={"idempotency_key": "retry-1"}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "job_not_retryable"


def test_retry_is_idempotent(client):
    project = _project(client)
    job_id = _submit(client, project["id"]).json()["id"]
    client.post(f"{PREFIX}/jobs/{job_id}/cancel")
    payload = {"idempotency_key": "same-key"}

    first = client.post(f"{PREFIX}/jobs/{job_id}/retry", json=payload).json()
    second = client.post(f"{PREFIX}/jobs/{job_id}/retry", json=payload).json()
    assert first["attempt"] == second["attempt"] == 2
    events = client.get(f"{PREFIX}/jobs/{job_id}/events").json()["events"]
    assert len(events) == 3  # queued, canceled, retried — no duplicate


def test_retry_missing_job(client):
    response = client.post(
        f"{PREFIX}/jobs/{uuid4()}/retry", json={"idempotency_key": "k"}
    )
    assert response.status_code == 404
