"""Authoritative single activity event overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "id",
    "kind",
    "project_id",
    "project_name",
    "actor_id",
    "label",
    "detail",
    "timestamp",
    "tone",
    "counts",
    "recent_events",
    "generated_at",
}
_COUNT_KEYS = {"total_events", "total_participants", "workspace_events", "by_kind"}
_KIND_KEYS = {"kind", "count"}


def _overview(client, event_id, **params):
    return client.get(f"{PREFIX}/activity/{event_id}/overview", params=params)


def _clear(client):
    client.app.state.store.clear()


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
    assert response.status_code == 201, response.text
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
    assert response.status_code == 201, response.text
    return response.json()


def _comment(client, project_id, body="Looks good"):
    response = client.post(
        f"{PREFIX}/comments", json={"project_id": project_id, "body": body}
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_overview_of_single_asset_event(client):
    _clear(client)
    project = _project(client, "Single")
    asset = _asset(client, project["id"], "Frame", provenance={"operation_id": "flf2v"})

    event_id = f"asset-{asset['id']}"
    response = _overview(client, event_id)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["id"] == event_id
    assert body["kind"] == "asset"
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Single"
    assert body["actor_id"] == asset["creator_id"]
    assert body["label"] == "Created Frame"
    assert body["detail"] == "flf2v"
    assert body["tone"] == "info"
    assert body["timestamp"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"]["total_events"] == 1
    assert body["counts"]["workspace_events"] == 1
    assert body["counts"]["total_participants"] == 1
    assert {bucket["kind"] for bucket in body["counts"]["by_kind"]} == {
        "asset",
        "publish",
        "job",
        "comment",
    }
    assert all(set(bucket) == _KIND_KEYS for bucket in body["counts"]["by_kind"])
    assert len(body["recent_events"]) == 1
    assert body["recent_events"][0]["id"] == event_id
    assert body["generated_at"]


def test_all_four_event_kinds_resolve(client):
    _clear(client)
    project = _project(client, "Kinds")
    asset = _asset(client, project["id"], "Hero")
    publisher = str(uuid4())
    assert client.patch(
        f"{PREFIX}/assets/{asset['id']}",
        json={"metadata": {"publish_receipt": {"publisher": publisher, "comment": "v1"}}},
    ).status_code == 200
    job = _job(client, project["id"])
    comment = _comment(client, project["id"])

    for event_id, kind in (
        (f"asset-{asset['id']}", "asset"),
        (f"publish-{asset['id']}", "publish"),
        (f"job-{job['id']}", "job"),
        (f"comment-{comment['id']}", "comment"),
    ):
        response = _overview(client, event_id)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["id"] == event_id
        assert body["kind"] == kind
        assert body["counts"]["total_events"] == 4


def test_counts_scoped_to_project_with_workspace_context(client):
    _clear(client)
    alpha = _project(client, "Alpha")["id"]
    beta = _project(client, "Beta")["id"]
    a1 = _asset(client, alpha, "A1")
    _asset(client, alpha, "A2")
    _asset(client, beta, "B1")

    event_id = f"asset-{a1['id']}"
    body = _overview(client, event_id).json()
    assert body["project_name"] == "Alpha"
    assert body["counts"]["total_events"] == 2  # only Alpha's events
    assert body["counts"]["workspace_events"] == 3
    kind_counts = {bucket["kind"]: bucket["count"] for bucket in body["counts"]["by_kind"]}
    assert kind_counts == {"asset": 2, "publish": 0, "job": 0, "comment": 0}
    assert {item["project_id"] for item in body["recent_events"]} == {alpha}


def test_recent_events_newest_first_and_bounded(client):
    _clear(client)
    project_id = _project(client, "Order")["id"]
    ids = [_asset(client, project_id, f"Asset {index}")["id"] for index in range(4)]
    event_id = f"asset-{ids[0]}"

    full = _overview(client, event_id, recent_limit=50).json()
    assert len(full["recent_events"]) == 4
    assert full["recent_events"] == sorted(
        full["recent_events"],
        key=lambda item: (item["timestamp"], item["id"]),
        reverse=True,
    )

    bounded = _overview(client, event_id, recent_limit=2).json()
    assert bounded["counts"]["total_events"] == 4  # counts not bounded by the page
    assert bounded["recent_events"] == full["recent_events"][:2]


def test_counts_agree_with_activity_stats(client):
    _clear(client)
    project_id = _project(client, "Stats")["id"]
    asset = _asset(client, project_id, "Hero")
    _job(client, project_id)
    _comment(client, project_id)

    scoped_stats = client.get(
        f"{PREFIX}/activity/stats", params={"project_id": project_id}
    ).json()
    workspace_stats = client.get(f"{PREFIX}/activity/stats").json()
    overview = _overview(client, f"asset-{asset['id']}").json()

    assert overview["counts"]["total_events"] == scoped_stats["total_events"]
    assert overview["counts"]["total_participants"] == scoped_stats["total_participants"]
    assert overview["counts"]["workspace_events"] == workspace_stats["total_events"]
    assert overview["counts"]["by_kind"] == scoped_stats["by_kind"]


def test_joins_project_name_with_orphan_fallback(client):
    _clear(client)
    project = _project(client, "Joined")
    asset = _asset(client, project["id"], "Orphan")

    event_id = f"asset-{asset['id']}"
    assert _overview(client, event_id).json()["project_name"] == "Joined"

    client.app.state.store.delete(Collections.PROJECTS, project["id"])
    body = _overview(client, event_id).json()
    assert body["project_name"] == "Unknown project"
    assert body["counts"]["total_events"] == 1  # still counted via the event's project id


def test_unknown_event_uses_shared_404_envelope(client):
    _clear(client)
    response = _overview(client, f"asset-{uuid4()}")
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "activity_not_found"
    assert error["request_id"]


def test_malformed_event_id_uses_shared_422_envelope(client):
    _clear(client)
    for event_id in ("missing", f"unknown-{uuid4()}", f"asset-{uuid4()}-tail", "asset-not-a-uuid"):
        response = _overview(client, event_id)
        assert response.status_code == 422, event_id
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    _clear(client)
    project_id = _project(client, "Limits")["id"]
    asset = _asset(client, project_id, "Limited")
    for limit in (0, 51):
        response = _overview(client, f"asset-{asset['id']}", recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
