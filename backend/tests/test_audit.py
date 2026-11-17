"""Project audit trail endpoint tests (success and failure paths)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX


def _project(client, name="Audit Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _asset(client, project_id, name="Hero", **extra):
    payload = {
        "project_id": project_id,
        "type": "image",
        "name": name,
        "storage": {
            "backend": "local",
            "key": f"Output/{name}.png",
            "size_bytes": 0,
            "content_type": "image/png",
        },
        **extra,
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201
    return response.json()


def _trail(client, project_id, **params):
    return client.get(f"{PREFIX}/projects/{project_id}/audit", params=params)


def test_audit_feed_is_authoritative_and_sorted(client):
    project = _project(client)
    asset = _asset(
        client,
        project["id"],
        "Frame",
        provenance={"operation_id": "frame-generation"},
    )
    published = _asset(client, project["id"], "Deliverable")
    # Publish receipts live in asset metadata; registration does not accept
    # metadata, so attach the receipt through the supported PATCH contract.
    patched = client.patch(
        f"{PREFIX}/assets/{published['id']}",
        json={
            "metadata": {
                "publish_receipt": {
                    "comment": "v1 sign-off",
                    "published_at": "2026-11-17T10:00:00+00:00",
                }
            }
        },
    )
    assert patched.status_code == 200
    job = client.post(
        f"{PREFIX}/jobs",
        json={
            "operation_id": "text-to-image",
            "schema_version": "1.0.0",
            "project_id": project["id"],
        },
    )
    assert job.status_code == 201
    job = job.json()

    response = _trail(client, project["id"])
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == {"project_id", "events"}
    assert body["project_id"] == project["id"]

    events = body["events"]
    assert {event["kind"] for event in events} == {"asset", "publish", "job"}
    assert {event["id"] for event in events} == {
        f"asset-{asset['id']}",
        f"asset-{published['id']}",
        f"publish-{published['id']}",
        f"job-{job['id']}",
    }
    timestamps = [event["timestamp"] for event in events]
    assert timestamps == sorted(timestamps, reverse=True)

    by_id = {event["id"]: event for event in events}
    created = by_id[f"asset-{asset['id']}"]
    assert created["label"] == "Created Frame"
    assert created["detail"] == "frame-generation"
    assert created["tone"] == "info"

    publish = by_id[f"publish-{published['id']}"]
    assert publish["label"] == "Published Deliverable"
    assert publish["detail"] == "v1 sign-off"
    assert publish["tone"] == "success"

    submitted = by_id[f"job-{job['id']}"]
    assert submitted["label"] == "text-to-image · queued"
    assert submitted["detail"] == "Attempt 1"
    assert submitted["tone"] == "neutral"


def test_audit_kind_filter_and_limit(client):
    project = _project(client)
    _asset(client, project["id"], "One")
    _asset(client, project["id"], "Two")
    client.post(
        f"{PREFIX}/jobs",
        json={
            "operation_id": "text-to-image",
            "schema_version": "1.0.0",
            "project_id": project["id"],
        },
    )

    assets = _trail(client, project["id"], kind="asset").json()["events"]
    assert len(assets) == 2
    assert all(event["kind"] == "asset" for event in assets)

    jobs = _trail(client, project["id"], kind="job").json()["events"]
    assert len(jobs) == 1
    assert jobs[0]["kind"] == "job"

    assert len(_trail(client, project["id"], kind="publish").json()["events"]) == 0
    assert len(_trail(client, project["id"], limit=2).json()["events"]) == 2

    for bad in (0, 501):
        response = _trail(client, project["id"], limit=bad)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


def test_audit_time_bounds_are_inclusive(client):
    project = _project(client)
    _asset(client, project["id"], "Old")
    _asset(client, project["id"], "New")

    all_events = _trail(client, project["id"]).json()["events"]
    assert len(all_events) == 2
    newest, oldest = all_events[0]["timestamp"], all_events[1]["timestamp"]

    since_only = _trail(client, project["id"], since=oldest).json()["events"]
    assert [event["timestamp"] for event in since_only] == [newest, oldest]

    until_only = _trail(client, project["id"], until=oldest).json()["events"]
    assert [event["timestamp"] for event in until_only] == [oldest]

    # A bound after every event yields an empty feed, not an error.
    future = "2999-01-01T00:00:00+00:00"
    assert _trail(client, project["id"], since=future).json()["events"] == []


def test_audit_empty_project_has_empty_feed(client):
    project = _project(client)
    response = _trail(client, project["id"])
    assert response.status_code == 200
    assert response.json() == {"project_id": project["id"], "events": []}


def test_audit_unknown_project_uses_error_envelope(client):
    response = _trail(client, uuid4())
    assert response.status_code == 404
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "project_not_found"
    assert body["error"]["message"]
    assert body["error"]["request_id"] == response.headers["X-Request-ID"]


def test_audit_rejects_unknown_kind(client):
    project = _project(client)
    response = _trail(client, project["id"], kind="not-a-kind")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_audit_isolates_projects(client):
    first = _project(client, "First")
    second = _project(client, "Second")
    asset = _asset(client, first["id"], "Only In First")

    events = _trail(client, second["id"]).json()["events"]
    assert events == []
    assert [event["id"] for event in _trail(client, first["id"]).json()["events"]] == [
        f"asset-{asset['id']}"
    ]
