"""Workspace activity feed endpoint tests (success and failure paths)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX


def _project(client, name="Activity Project"):
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


def _job(client, project_id):
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


def _comment(client, project_id, body="Looks good"):
    response = client.post(
        f"{PREFIX}/comments", json={"project_id": project_id, "body": body}
    )
    assert response.status_code == 201
    return response.json()


def _feed(client, **params):
    return client.get(f"{PREFIX}/activity", params=params)


def test_activity_feed_is_authoritative_and_sorted(client):
    project = _project(client)
    asset = _asset(
        client,
        project["id"],
        "Frame",
        provenance={"operation_id": "frame-generation"},
    )
    published = _asset(client, project["id"], "Deliverable")
    publisher = str(uuid4())
    patched = client.patch(
        f"{PREFIX}/assets/{published['id']}",
        json={
            "metadata": {
                "publish_receipt": {"comment": "v1 sign-off", "publisher": publisher}
            }
        },
    )
    assert patched.status_code == 200
    job = _job(client, project["id"])
    comment = _comment(client, project["id"])

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == {"events", "total"}
    assert body["total"] == 5
    events = body["events"]
    assert len(events) == 5

    assert {event["kind"] for event in events} == {"asset", "publish", "job", "comment"}
    assert {event["id"] for event in events} == {
        f"asset-{asset['id']}",
        f"asset-{published['id']}",
        f"publish-{published['id']}",
        f"job-{job['id']}",
        f"comment-{comment['id']}",
    }
    timestamps = [event["timestamp"] for event in events]
    assert timestamps == sorted(timestamps, reverse=True)

    by_id = {event["id"]: event for event in events}
    created = by_id[f"asset-{asset['id']}"]
    assert created["project_id"] == project["id"]
    assert created["label"] == "Created Frame"
    assert created["detail"] == "frame-generation"
    assert created["tone"] == "info"

    publish = by_id[f"publish-{published['id']}"]
    assert publish["detail"] == "v1 sign-off"
    assert publish["tone"] == "success"
    assert publish["actor_id"] == publisher

    submitted = by_id[f"job-{job['id']}"]
    assert submitted["label"] == "text-to-image · queued"
    assert submitted["detail"] == "Attempt 1"
    assert submitted["tone"] == "neutral"

    noted = by_id[f"comment-{comment['id']}"]
    assert noted["kind"] == "comment"
    assert noted["detail"] == "Looks good"
    assert noted["tone"] == "accent"


def test_activity_cross_project_scope_kind_filter_and_limit(client):
    first = _project(client, "First")
    second = _project(client, "Second")
    first_asset = _asset(client, first["id"], "First Hero")
    first_asset_2 = _asset(client, first["id"], "Second Hero")
    _asset(client, second["id"], "Other Project Hero")
    _job(client, second["id"])

    workspace = _feed(client).json()
    assert workspace["total"] == 4
    assert len(workspace["events"]) == 4

    scoped = _feed(client, project_id=first["id"]).json()
    assert scoped["total"] == 2
    assert {event["id"] for event in scoped["events"]} == {
        f"asset-{first_asset['id']}",
        f"asset-{first_asset_2['id']}",
    }

    assets_only = _feed(client, kind="asset").json()
    assert assets_only["total"] == 3
    assert all(event["kind"] == "asset" for event in assets_only["events"])

    comments_only = _feed(client, kind="comment").json()
    assert comments_only == {"events": [], "total": 0}

    limited = _feed(client, limit=2).json()
    assert len(limited["events"]) == 2
    assert limited["total"] == 4


def test_activity_empty_workspace_has_empty_feed(client):
    response = _feed(client)
    assert response.status_code == 200
    assert response.json() == {"events": [], "total": 0}


def test_activity_unknown_project_uses_error_envelope(client):
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "project_not_found"
    assert body["error"]["message"]
    assert body["error"]["request_id"] == response.headers["X-Request-ID"]


def test_activity_rejects_invalid_filters(client):
    for params in (
        {"kind": "not-a-kind"},
        {"limit": 0},
        {"limit": 201},
        {"project_id": "not-a-uuid"},
    ):
        response = _feed(client, **params)
        assert response.status_code == 422, params
        assert response.json()["error"]["code"] == "validation_error"
