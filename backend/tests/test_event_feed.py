"""Authoritative job event feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "job_id",
    "seq",
    "type",
    "operation_id",
    "project_id",
    "project_name",
    "status",
    "progress",
    "message",
    "asset_id",
    "error",
    "timestamp",
}
_TYPES = ["status", "progress", "intermediate", "result", "error", "log"]


def _feed(client, **params):
    return client.get(f"{PREFIX}/events/feed", params=params)


def _project(client, *, name="Feed Event Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _job(client, project_id, *, operation_id="text-to-image"):
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


def _clear_events(client):
    """Remove auto-emitted submit events so seeded counts are deterministic."""
    store = client.app.state.store
    for doc in list(store.all(Collections.JOB_EVENTS)):
        store.delete(Collections.JOB_EVENTS, f"{doc['job_id']}:{doc['seq']:012d}")


def _append(client, job_id, event_type, **fields):
    """Emit an event through the same authoritative write path jobs use."""
    return client.app.state.repositories.jobs.append_event(job_id, event_type, **fields)


def _put_event(client, job_id, seq, event_type, *, timestamp=None, **fields):
    """Seed a fully-populated event directly into the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.operation import JobEvent

    event = JobEvent(
        type=event_type,
        job_id=job_id,
        seq=seq,
        timestamp=timestamp or utcnow(),
        **fields,
    )
    client.app.state.store.put(
        Collections.JOB_EVENTS,
        f"{job_id}:{seq:012d}",
        event.model_dump(mode="json"),
    )
    return event


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["timestamp"], item["job_id"], item["seq"]),
        reverse=True,
    )


def test_event_feed_empty_store_is_zero_filled(client):
    client.app.state.store.clear()

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_event_feed_is_newest_first_with_job_project_join_and_fields(client):
    from app.schemas.common import utcnow

    client.app.state.store.clear()
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")
    j1 = _job(client, alpha["id"], operation_id="text-to-image")
    j2 = _job(client, beta["id"], operation_id="lora-train")
    _clear_events(client)

    now = utcnow()
    asset_id = uuid4()
    error = {"code": "worker_offline", "message": "retry later", "retryable": True}
    oldest = _put_event(
        client,
        j1["id"],
        0,
        "progress",
        timestamp=now - timedelta(hours=2),
        progress=0.25,
        message="step 1",
    )
    newest = _put_event(
        client,
        j2["id"],
        0,
        "error",
        timestamp=now,
        status="failed",
        error=error,
    )
    middle = _put_event(
        client,
        j1["id"],
        1,
        "result",
        timestamp=now - timedelta(hours=1),
        asset_id=asset_id,
        message="done",
    )

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)
    assert [item["seq"] for item in items] == [newest.seq, middle.seq, oldest.seq]
    assert {item["job_id"] for item in items} == {j1["id"], j2["id"]}

    by_key = {(item["job_id"], item["seq"]): item for item in items}
    assert set(by_key[(j1["id"], 0)]) == _ITEM_KEYS

    first = by_key[(j1["id"], 0)]
    assert first["type"] == "progress"
    assert first["operation_id"] == "text-to-image"
    assert first["project_id"] == alpha["id"]
    assert first["project_name"] == "Alpha Project"
    assert first["progress"] == 0.25
    assert first["message"] == "step 1"
    assert first["asset_id"] is None
    assert first["error"] is None
    assert first["timestamp"]

    second = by_key[(j1["id"], 1)]
    assert second["type"] == "result"
    assert second["asset_id"] == str(asset_id)
    assert second["project_name"] == "Alpha Project"

    third = by_key[(j2["id"], 0)]
    assert third["type"] == "error"
    assert third["operation_id"] == "lora-train"
    assert third["project_name"] == "Beta Project"
    assert third["status"] == "failed"
    assert third["error"]["code"] == "worker_offline"


def test_event_feed_deterministic_tie_break_on_equal_timestamps(client):
    from app.schemas.common import utcnow

    client.app.state.store.clear()
    project = _project(client)
    j1 = _job(client, project["id"])
    j2 = _job(client, project["id"])
    _clear_events(client)

    same_time = utcnow()
    _put_event(client, j1["id"], 0, "log", timestamp=same_time)
    _put_event(client, j2["id"], 0, "log", timestamp=same_time)
    _put_event(client, j1["id"], 1, "log", timestamp=same_time)

    items = _feed(client).json()["items"]
    assert _sorted_desc(items)
    # Equal timestamps: highest (job_id, seq) pair comes first.
    assert items == sorted(
        items,
        key=lambda item: (item["timestamp"], item["job_id"], item["seq"]),
        reverse=True,
    )


def test_event_feed_skips_orphan_events_with_missing_job(client):
    client.app.state.store.clear()
    project = _project(client)
    job = _job(client, project["id"])
    _clear_events(client)

    kept = _append(client, job["id"], "status")
    orphan_job_id = uuid4()
    _put_event(client, orphan_job_id, 0, "log")

    body = _feed(client).json()
    assert body["total"] == 1
    assert body["items"][0]["job_id"] == job["id"]
    assert body["items"][0]["seq"] == kept.seq
    assert all(item["job_id"] != str(orphan_job_id) for item in body["items"])


def test_event_feed_uses_fallback_for_missing_project(client):
    client.app.state.store.clear()
    project = _project(client)
    job = _job(client, project["id"])
    _clear_events(client)
    _append(client, job["id"], "status")

    # Drop only the project document; the job keeps its project_id, so the feed
    # keeps the event with a stable fallback name rather than dropping it.
    client.app.state.store.delete(Collections.PROJECTS, project["id"])

    body = _feed(client).json()
    assert body["total"] == 1
    assert body["items"][0]["project_name"] == "Unknown project"
    assert body["items"][0]["project_id"] == project["id"]


def test_event_feed_project_scope_narrows_derivation(client):
    client.app.state.store.clear()
    alpha = _project(client, name="Alpha Project")
    beta = _project(client, name="Beta Project")
    j1 = _job(client, alpha["id"])
    j2 = _job(client, beta["id"])
    _clear_events(client)

    _append(client, j1["id"], "status")
    _append(client, j2["id"], "log")
    _append(client, j2["id"], "progress")

    scoped = _feed(client, project_id=alpha["id"]).json()
    assert scoped["total"] == 1
    assert [item["job_id"] for item in scoped["items"]] == [j1["id"]]
    assert scoped["items"][0]["project_name"] == "Alpha Project"

    assert _feed(client).json()["total"] == 3
    assert _feed(client, project_id=beta["id"]).json()["total"] == 2


def test_event_feed_type_filter_narrows_derivation(client):
    client.app.state.store.clear()
    project = _project(client)
    job = _job(client, project["id"])
    _clear_events(client)

    _append(client, job["id"], "status")
    _append(client, job["id"], "progress")
    _append(client, job["id"], "error")

    body = _feed(client, type="error").json()
    assert body["total"] == 1
    assert body["items"][0]["type"] == "error"

    assert _feed(client, type="progress").json()["total"] == 1
    assert _feed(client, type="intermediate").json()["total"] == 0
    assert _feed(client).json()["total"] == 3


def test_event_feed_limit_bounds_page_but_not_total(client):
    client.app.state.store.clear()
    project = _project(client)
    job = _job(client, project["id"])
    _clear_events(client)
    for index in range(4):
        _append(client, job["id"], "log", message=f"entry {index}")

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_event_feed_is_derived_live_from_the_store(client):
    client.app.state.store.clear()
    project = _project(client)
    job = _job(client, project["id"])
    _clear_events(client)

    assert _feed(client).json()["total"] == 0
    emitted = _append(client, job["id"], "status", message="queued")
    after = _feed(client).json()
    assert after["total"] == 1
    assert after["items"][0]["message"] == "queued"
    assert after["items"][0]["seq"] == emitted.seq

    # Removing the event from the authoritative store removes it from the feed.
    client.app.state.store.delete(
        Collections.JOB_EVENTS, f"{job['id']}:{emitted.seq:012d}"
    )
    assert _feed(client).json()["total"] == 0


def test_event_feed_total_agrees_with_event_stats_derived_stream(client):
    client.app.state.store.clear()
    project = _project(client)
    j1 = _job(client, project["id"])
    j2 = _job(client, project["id"])
    _clear_events(client)
    for job_id in (j1["id"], j2["id"]):
        for event_type in ("status", "progress", "result"):
            _append(client, job_id, event_type)

    assert _feed(client).json()["total"] == 6
    assert _feed(client, project_id=project["id"]).json()["total"] == 6
    stats = client.get(f"{PREFIX}/events/stats").json()
    assert stats["total_events"] == 6


def test_event_feed_unknown_project_uses_shared_404_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_event_feed_malformed_project_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_event_feed_invalid_type_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    response = _feed(client, type="not-a-type")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_event_feed_invalid_limit_uses_shared_422_envelope(client):
    client.app.state.store.clear()
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
