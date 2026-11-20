"""Authoritative single collaboration-signal overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from uuid import uuid4

from app.storage.base import Collections

from .conftest import PREFIX

_KEYS = {
    "signal_id",
    "signal",
    "project_id",
    "project_name",
    "actor_id",
    "state",
    "body",
    "asset_id",
    "occurred_at",
    "counts",
    "recent_signals",
    "generated_at",
}
_COUNT_KEYS = {
    "project_signals",
    "project_presence",
    "project_comments",
    "project_participants",
    "workspace_signals",
    "by_state",
}
_STATE_KEYS = {"state", "count"}


def _overview(client, signal_key, **params):
    return client.get(f"{PREFIX}/collaboration/{signal_key}/overview", params=params)


def _key(signal, project_id, signal_id):
    return f"{signal}:{project_id}:{signal_id}"


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Collab Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _comment(client, project_id, body="Looks good", asset_id=None):
    payload = {"project_id": project_id, "body": body}
    if asset_id is not None:
        payload["asset_id"] = asset_id
    response = client.post(f"{PREFIX}/comments", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def _asset(client, project_id, name="Ref"):
    response = client.post(
        f"{PREFIX}/assets/register",
        json={
            "project_id": project_id,
            "type": "image",
            "name": name,
            "storage": {
                "backend": "local",
                "key": f"Output/{name}.png",
                "size_bytes": 0,
                "content_type": "image/png",
            },
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _presence(client, project_id, user_id=None, state="online", last_seen_at=None):
    payload = {
        "project_id": project_id,
        "user_id": str(user_id or uuid4()),
        "state": state,
        "last_seen_at": last_seen_at or "2026-01-01T00:00:00Z",
    }
    response = client.post(f"{PREFIX}/presence", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_overview_of_single_comment_signal(client):
    _clear(client)
    project = _project(client, "Single")
    asset = _asset(client, project["id"])
    comment = _comment(client, project["id"], body="Ship it", asset_id=asset["id"])

    key = _key("comment", project["id"], comment["id"])
    response = _overview(client, key)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    body = response.json()
    assert set(body) == _KEYS
    assert body["signal_id"] == comment["id"]
    assert body["signal"] == "comment"
    assert body["project_id"] == project["id"]
    assert body["project_name"] == "Single"
    assert body["actor_id"] == comment["author_id"]
    assert body["body"] == "Ship it"
    assert body["asset_id"] == comment["asset_id"]
    assert body["state"] is None
    assert body["occurred_at"]
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"]["project_signals"] == 1
    assert body["counts"]["project_comments"] == 1
    assert body["counts"]["project_presence"] == 0
    assert body["counts"]["project_participants"] == 1
    assert body["counts"]["workspace_signals"] == 1
    assert {bucket["state"] for bucket in body["counts"]["by_state"]} == {
        "online",
        "away",
        "offline",
    }
    assert all(set(bucket) == _STATE_KEYS for bucket in body["counts"]["by_state"])
    assert len(body["recent_signals"]) == 1
    assert body["recent_signals"][0]["signal_id"] == comment["id"]
    assert body["generated_at"]


def test_overview_of_single_presence_signal(client):
    _clear(client)
    project = _project(client, "Present")
    presence = _presence(client, project["id"], state="away")

    key = _key("presence", project["id"], presence["user_id"])
    body = _overview(client, key).json()
    assert body["signal_id"] == presence["user_id"]
    assert body["signal"] == "presence"
    assert body["actor_id"] == presence["user_id"]
    assert body["state"] == "away"
    assert body["body"] is None
    assert body["asset_id"] is None
    assert body["counts"]["project_presence"] == 1
    assert body["counts"]["project_comments"] == 0
    by_state = {bucket["state"]: bucket["count"] for bucket in body["counts"]["by_state"]}
    assert by_state == {"online": 0, "away": 1, "offline": 0}


def test_counts_scoped_to_project_with_workspace_context(client):
    _clear(client)
    alpha = _project(client, "Alpha")["id"]
    beta = _project(client, "Beta")["id"]
    comment = _comment(client, alpha, body="Alpha only")
    _presence(client, alpha)
    _comment(client, beta, body="Beta only")
    _presence(client, beta)

    body = _overview(client, _key("comment", alpha, comment["id"])).json()
    assert body["project_name"] == "Alpha"
    assert body["counts"]["project_signals"] == 2  # Alpha's comment + presence
    assert body["counts"]["project_comments"] == 1
    assert body["counts"]["project_presence"] == 1
    assert body["counts"]["workspace_signals"] == 4  # all signals in both projects
    assert {item["project_id"] for item in body["recent_signals"]} == {alpha}


def test_counts_agree_with_collaboration_stats(client):
    _clear(client)
    project_id = _project(client, "Stats")["id"]
    _comment(client, project_id, body="One")
    _comment(client, project_id, body="Two")
    _presence(client, project_id, state="online")
    _presence(client, project_id, state="offline")
    comment = _comment(client, project_id, body="Three")

    scoped = client.get(
        f"{PREFIX}/collaboration/stats", params={"project_id": project_id}
    ).json()
    workspace = client.get(f"{PREFIX}/collaboration/stats").json()
    overview = _overview(client, _key("comment", project_id, comment["id"])).json()

    assert overview["counts"]["project_signals"] == (
        scoped["total_presence"] + scoped["total_comments"]
    )
    assert overview["counts"]["project_presence"] == scoped["total_presence"]
    assert overview["counts"]["project_comments"] == scoped["total_comments"]
    assert overview["counts"]["project_participants"] == scoped["total_participants"]
    assert overview["counts"]["workspace_signals"] == (
        workspace["total_presence"] + workspace["total_comments"]
    )
    assert overview["counts"]["by_state"] == scoped["by_state"]


def test_recent_signals_newest_first_and_bounded(client):
    _clear(client)
    project_id = _project(client, "Order")["id"]
    comments = [_comment(client, project_id, body=f"C{index}") for index in range(4)]
    _presence(client, project_id)
    key = _key("comment", project_id, comments[0]["id"])

    full = _overview(client, key, recent_limit=50).json()
    assert len(full["recent_signals"]) == 5
    assert full["recent_signals"] == sorted(
        full["recent_signals"],
        key=lambda item: (
            item["occurred_at"],
            str(item["signal_id"]),
            item["signal"],
            str(item["project_id"]),
        ),
        reverse=True,
    )

    bounded = _overview(client, key, recent_limit=2).json()
    assert bounded["counts"]["project_signals"] == 5  # counts not bounded by the page
    assert bounded["recent_signals"] == full["recent_signals"][:2]


def test_joins_project_name_with_orphan_fallback(client):
    _clear(client)
    project = _project(client, "Joined")
    comment = _comment(client, project["id"])

    key = _key("comment", project["id"], comment["id"])
    assert _overview(client, key).json()["project_name"] == "Joined"

    client.app.state.store.delete(Collections.PROJECTS, project["id"])
    body = _overview(client, key).json()
    assert body["project_name"] == "Unknown project"
    assert body["counts"]["project_signals"] == 1  # still counted via the signal's project id


def test_unknown_signal_uses_shared_404_envelope(client):
    _clear(client)
    _project(client, "Missing")
    key = _key("comment", str(uuid4()), str(uuid4()))
    response = _overview(client, key)
    assert response.status_code == 404
    assert response.headers["X-Request-ID"]
    error = response.json()["error"]
    assert error["code"] == "collaboration_signal_not_found"
    assert error["request_id"]


def test_malformed_signal_key_uses_shared_422_envelope(client):
    _clear(client)
    project_id = str(uuid4())
    signal_id = str(uuid4())
    for key in (
        "missing",
        f"unknown:{project_id}:{signal_id}",
        f"comment:{project_id}",
        f"comment:{project_id}:{signal_id}:tail",
        f"comment:not-a-uuid:{signal_id}",
        f"comment:{project_id}:not-a-uuid",
        f"comment-{project_id}-{signal_id}",
    ):
        response = _overview(client, key)
        assert response.status_code == 422, key
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"


def test_invalid_recent_limit_uses_shared_422_envelope(client):
    _clear(client)
    project_id = _project(client, "Limits")["id"]
    comment = _comment(client, project_id, body="Limited")
    for limit in (0, 51):
        response = _overview(client, _key("comment", project_id, comment["id"]), recent_limit=limit)
        assert response.status_code == 422
        assert response.headers["X-Request-ID"]
        assert response.json()["error"]["code"] == "validation_error"
