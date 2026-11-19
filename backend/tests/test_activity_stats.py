"""Authoritative activity statistics endpoint tests (success + failure)."""

from __future__ import annotations

from uuid import uuid4

from .conftest import PREFIX

_KINDS = ["asset", "publish", "job", "comment"]
_KEYS = {
    "total_events",
    "total_participants",
    "by_kind",
    "by_project",
    "newest_event_at",
    "generated_at",
}


def _stats(client, **params):
    return client.get(f"{PREFIX}/activity/stats", params=params)


def _feed(client):
    return client.get(f"{PREFIX}/activity").json()


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Activity Stats Project"):
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


def _set_actor(client, collection, doc_id, field, actor_id):
    """Retarget an authored document's actor id in the authoritative store."""
    from app.storage.base import Collections

    store = client.app.state.store
    document = store.get(collection, doc_id)
    document[field] = str(actor_id)
    store.put(collection, doc_id, document)


def test_activity_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_events"] == 0
    assert body["total_participants"] == 0
    assert body["by_kind"] == [{"kind": kind, "count": 0} for kind in _KINDS]
    assert body["by_project"] == []
    assert body["newest_event_at"] is None
    assert body["generated_at"]


def test_activity_stats_derives_totals_breakdowns_and_recency(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    # P1: two asset-creation events + one publish + one job + one comment = 5.
    _asset(client, p1, "Frame", provenance={"operation_id": "frame-generation"})
    published = _asset(client, p1, "Deliverable")
    publisher = str(uuid4())
    patched = client.patch(
        f"{PREFIX}/assets/{published['id']}",
        json={"metadata": {"publish_receipt": {"comment": "v1", "publisher": publisher}}},
    )
    assert patched.status_code == 200
    _job(client, p1)
    _comment(client, p1)
    # P2: one asset-creation event = 1.
    _asset(client, p2, "Other Hero")

    body = _stats(client).json()
    assert body["total_events"] == 6
    # Every actor is the dev identity except the publish receipt's custom publisher.
    assert body["total_participants"] == 2
    assert body["by_kind"] == [
        {"kind": "asset", "count": 3},
        {"kind": "publish", "count": 1},
        {"kind": "job", "count": 1},
        {"kind": "comment", "count": 1},
    ]
    assert body["by_project"] == [
        {"project_id": p1, "events": 5, "participants": 2},
        {"project_id": p2, "events": 1, "participants": 1},
    ]

    # Recency matches the newest event in the authoritative activity feed.
    feed = _feed(client)
    assert body["newest_event_at"] == max(
        event["timestamp"] for event in feed["events"]
    )


def test_activity_stats_project_scope_unknown_and_malformed(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]
    _asset(client, p1, "A1")
    _job(client, p1)
    _asset(client, p2, "B1")
    _asset(client, p2, "B2")
    _job(client, p2)
    _comment(client, p2)

    scoped = _stats(client, project_id=p1)
    assert scoped.status_code == 200
    body = scoped.json()
    assert body["total_events"] == 2
    assert body["by_kind"] == [
        {"kind": "asset", "count": 1},
        {"kind": "publish", "count": 0},
        {"kind": "job", "count": 1},
        {"kind": "comment", "count": 0},
    ]
    assert body["by_project"] == [
        {"project_id": p1, "events": 2, "participants": 1}
    ]

    # Unknown-but-well-formed project uses the shared 404 envelope.
    missing = _stats(client, project_id=uuid4())
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "project_not_found"
    assert missing.headers["X-Request-ID"]

    malformed = _stats(client, project_id="not-a-uuid")
    assert malformed.status_code == 422
    error = malformed.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == malformed.headers["X-Request-ID"]


def test_activity_stats_counts_distinct_participants(client):
    from app.storage.base import Collections

    _clear(client)
    p = _project(client)["id"]
    u1, u2, u3 = uuid4(), uuid4(), uuid4()

    a1 = _asset(client, p, "A1")
    a2 = _asset(client, p, "A2")
    job = _job(client, p)
    comment = _comment(client, p)
    _set_actor(client, Collections.ASSETS, a1["id"], "creator_id", u1)
    _set_actor(client, Collections.ASSETS, a2["id"], "creator_id", u2)
    _set_actor(client, Collections.JOBS, job["id"], "created_by", u3)
    _set_actor(client, Collections.COMMENTS, comment["id"], "author_id", u1)

    body = _stats(client).json()
    assert body["total_events"] == 4
    assert body["total_participants"] == 3  # u1, u2, u3
    assert body["by_project"] == [
        {"project_id": p, "events": 4, "participants": 3}
    ]


def test_activity_stats_by_project_tie_break_is_deterministic(client):
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    _clear(client)
    low, high = uuid4(), uuid4()
    if low > high:
        low, high = high, low
    now = utcnow()
    for project_id in (low, high):
        client.app.state.store.put(
            Collections.PROJECTS,
            str(project_id),
            Project(
                id=project_id,
                org_id=uuid4(),
                name="P",
                created_by=uuid4(),
                created_at=now,
                updated_at=now,
            ).model_dump(mode="json"),
        )
    for project_id in (high, low):
        _asset(client, str(project_id), "Tie")

    body = _stats(client).json()
    assert body["by_project"] == [
        {"project_id": str(low), "events": 1, "participants": 1},
        {"project_id": str(high), "events": 1, "participants": 1},
    ]


def test_activity_stats_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    _clear(client)
    p = _project(client)["id"]
    assert _stats(client).json()["total_events"] == 0

    asset = _asset(client, p, "New")
    first = _stats(client).json()
    assert first["total_events"] == 1
    assert first["by_kind"][0] == {"kind": "asset", "count": 1}
    assert first["newest_event_at"] is not None

    client.app.state.store.delete(Collections.ASSETS, asset["id"])
    second = _stats(client).json()
    assert second["total_events"] == 0
    assert second["total_participants"] == 0
    assert second["by_kind"] == [{"kind": kind, "count": 0} for kind in _KINDS]
    assert second["by_project"] == []
    assert second["newest_event_at"] is None
