"""SSE job-event stream tests and polling-fallback parity."""

from __future__ import annotations

import json
from uuid import uuid4

from .conftest import PREFIX


def _project(client, name="Events Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _submit(client, project_id):
    response = client.post(
        f"{PREFIX}/jobs",
        json={
            "operation_id": "text-to-image",
            "schema_version": "1.0.0",
            "project_id": project_id,
        },
    )
    assert response.status_code == 201
    return response.json()


def _stream(client, job_id, **params):
    return client.stream(
        "GET", f"{PREFIX}/jobs/{job_id}/events/stream", params=params
    )


def test_stream_initial_event(client):
    job_id = _submit(client, _project(client)["id"])["id"]
    with _stream(client, job_id, idle_timeout=0) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers["cache-control"] == "no-cache"
        body = "".join(response.iter_text())

    assert body.count("event: job") == 1
    assert "id: 0" in body
    data_line = next(line for line in body.splitlines() if line.startswith("data: "))
    event = json.loads(data_line.removeprefix("data: "))
    assert event["seq"] == 0
    assert event["status"] == "queued"
    assert event["job_id"] == job_id


def test_stream_since_resume(client):
    project_id = _project(client)["id"]
    job_id = _submit(client, project_id)["id"]
    client.post(f"{PREFIX}/jobs/{job_id}/cancel")

    with _stream(client, job_id, since=1, idle_timeout=0) as response:
        body = "".join(response.iter_text())
    assert body.count("event: job") == 1
    assert "id: 1" in body
    assert "canceled" in body


def test_stream_matches_polling_fallback(client):
    project_id = _project(client)["id"]
    job_id = _submit(client, project_id)["id"]
    client.post(f"{PREFIX}/jobs/{job_id}/cancel")

    with _stream(client, job_id, idle_timeout=0) as response:
        body = "".join(response.iter_text())
    streamed = [
        json.loads(line.removeprefix("data: "))
        for line in body.splitlines()
        if line.startswith("data: ")
    ]
    polled = client.get(f"{PREFIX}/jobs/{job_id}/events").json()["events"]
    assert streamed == polled


def test_stream_missing_job(client):
    with _stream(client, uuid4(), idle_timeout=0) as response:
        assert response.status_code == 404
        response.read()
        assert response.json()["error"]["code"] == "job_not_found"


def test_stream_rejects_bad_params(client):
    job_id = _submit(client, _project(client)["id"])["id"]
    with _stream(client, job_id, since=-1) as response:
        assert response.status_code == 422
    with _stream(client, job_id, idle_timeout=999) as response:
        assert response.status_code == 422
