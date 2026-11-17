"""Orchestration, presence, comments and storage endpoint tests."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from .conftest import PREFIX


def _project(client, name="Orch Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _run_payload(project_id, goal="make a video with a lora"):
    return {"project_id": project_id, "goal": goal}


def _register_asset(client, project_id, size_bytes=1024):
    payload = {
        "project_id": project_id,
        "type": "image",
        "name": "Frame",
        "storage": {
            "backend": "local",
            "key": f"{uuid4()}.png",
            "size_bytes": size_bytes,
            "content_type": "image/png",
        },
    }
    response = client.post(f"{PREFIX}/assets/register", json=payload)
    assert response.status_code == 201
    return response.json()


# --- Plans ------------------------------------------------------------------


def test_create_plan(client):
    project_id = _project(client)["id"]
    response = client.post(
        f"{PREFIX}/orchestration/plans", json=_run_payload(project_id)
    )
    assert response.status_code == 201
    plan = response.json()
    assert plan["project_id"] == project_id
    assert plan["goal"] == "make a video with a lora"
    assert [step["operation_id"] for step in plan["steps"]] == [
        "image-to-video",
        "lora-train",
    ]
    assert plan["steps"][0]["step_id"] == "step_01"
    assert plan["steps"][0]["depends_on"] == []
    assert plan["steps"][1]["depends_on"] == ["step_01"]


def test_create_plan_default_step(client):
    project_id = _project(client)["id"]
    plan = client.post(
        f"{PREFIX}/orchestration/plans",
        json=_run_payload(project_id, goal="just chat"),
    ).json()
    assert [step["operation_id"] for step in plan["steps"]] == ["text-to-text"]


def test_plan_catalog_guard(client):
    """Planner must only emit operations present in the catalog."""
    project_id = _project(client)["id"]
    plan = client.post(
        f"{PREFIX}/orchestration/plans",
        json=_run_payload(project_id, goal="splat and 3d reconstruction"),
    ).json()
    ops = [step["operation_id"] for step in plan["steps"]]
    assert ops == ["splat-train"]


def test_create_plan_missing_project(client):
    response = client.post(
        f"{PREFIX}/orchestration/plans", json=_run_payload(str(uuid4()))
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


def test_create_plan_archived_project(client):
    project_id = _project(client)["id"]
    assert client.delete(f"{PREFIX}/projects/{project_id}").status_code == 204
    response = client.post(
        f"{PREFIX}/orchestration/plans", json=_run_payload(project_id)
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "project_archived"


def test_get_and_list_plans(client):
    p1 = _project(client, "One")["id"]
    p2 = _project(client, "Two")["id"]
    plan = client.post(
        f"{PREFIX}/orchestration/plans", json=_run_payload(p1)
    ).json()
    client.post(f"{PREFIX}/orchestration/plans", json=_run_payload(p2))

    assert client.get(f"{PREFIX}/orchestration/plans/{plan['plan_id']}").json() == plan
    assert len(client.get(f"{PREFIX}/orchestration/plans").json()) == 2
    assert (
        len(
            client.get(
                f"{PREFIX}/orchestration/plans", params={"project_id": p1}
            ).json()
        )
        == 1
    )
    missing = client.get(f"{PREFIX}/orchestration/plans/{uuid4()}")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "plan_not_found"


# --- Runs -------------------------------------------------------------------


def test_create_and_get_run(client, settings):
    project_id = _project(client)["id"]
    response = client.post(
        f"{PREFIX}/orchestration/runs", json=_run_payload(project_id)
    )
    assert response.status_code == 201
    run = response.json()
    assert run["stage"] == "plan"
    assert run["job_ids"] == []
    assert client.get(f"{PREFIX}/orchestration/runs/{run['run_id']}").json() == run

    people = client.get(
        f"{PREFIX}/presence", params={"project_id": project_id}
    ).json()
    assert len(people) == 1
    assert people[0]["user_id"] == str(settings.default_user_id)
    assert people[0]["state"] == "online"


def test_get_missing_run(client):
    response = client.get(f"{PREFIX}/orchestration/runs/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "run_not_found"


# --- Presence ---------------------------------------------------------------


def test_upsert_presence(client):
    project_id = _project(client)["id"]
    user_id = str(uuid4())
    presence = {
        "user_id": user_id,
        "project_id": project_id,
        "state": "away",
        "last_seen_at": datetime.now(UTC).isoformat(),
    }
    assert client.post(f"{PREFIX}/presence", json=presence).status_code == 201
    updated = {**presence, "state": "online"}
    assert client.post(f"{PREFIX}/presence", json=updated).status_code == 201
    entries = client.get(
        f"{PREFIX}/presence", params={"project_id": project_id}
    ).json()
    assert len(entries) == 1  # upsert, not duplicate
    assert entries[0]["state"] == "online"


def test_presence_missing_project(client):
    response = client.get(f"{PREFIX}/presence", params={"project_id": uuid4()})
    assert response.status_code == 404


# --- Comments ---------------------------------------------------------------


def test_add_and_list_comments(client, settings):
    project_id = _project(client)["id"]
    asset = _register_asset(client, project_id)
    response = client.post(
        f"{PREFIX}/comments",
        json={
            "project_id": project_id,
            "body": "Looks good",
            "asset_id": asset["id"],
        },
    )
    assert response.status_code == 201
    comment = response.json()
    assert comment["author_id"] == str(settings.default_user_id)
    assert comment["body"] == "Looks good"

    all_comments = client.get(
        f"{PREFIX}/comments", params={"project_id": project_id}
    ).json()
    assert [item["id"] for item in all_comments] == [comment["id"]]
    anchored = client.get(
        f"{PREFIX}/comments",
        params={"project_id": project_id, "asset_id": asset["id"]},
    ).json()
    assert [item["id"] for item in anchored] == [comment["id"]]
    assert (
        client.get(
            f"{PREFIX}/comments",
            params={"project_id": project_id, "asset_id": uuid4()},
        ).json()
        == []
    )


def test_comment_empty_body_rejected(client):
    project_id = _project(client)["id"]
    response = client.post(
        f"{PREFIX}/comments", json={"project_id": project_id, "body": ""}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_comment_foreign_asset_rejected(client):
    project_id = _project(client)["id"]
    other = _project(client, "Other")["id"]
    foreign = _register_asset(client, other)
    response = client.post(
        f"{PREFIX}/comments",
        json={"project_id": project_id, "body": "hello", "asset_id": foreign["id"]},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_asset"


# --- Storage stats ----------------------------------------------------------


def test_storage_stats(client, settings):
    project_id = _project(client)["id"]
    _register_asset(client, project_id, size_bytes=100)
    _register_asset(client, project_id, size_bytes=250)
    response = client.get(
        f"{PREFIX}/storage/stats", params={"project_id": project_id}
    )
    assert response.status_code == 200
    stats = response.json()
    assert stats["project_id"] == project_id
    assert stats["object_count"] == 2
    assert stats["quota"]["used"] == 350
    assert stats["quota"]["limit"] == settings.storage_quota_bytes
    assert stats["quota"]["unit"] == "bytes"


def test_storage_stats_empty_project(client):
    project_id = _project(client)["id"]
    stats = client.get(
        f"{PREFIX}/storage/stats", params={"project_id": project_id}
    ).json()
    assert stats["object_count"] == 0
    assert stats["quota"]["used"] == 0


def test_storage_stats_missing_project(client):
    response = client.get(f"{PREFIX}/storage/stats", params={"project_id": uuid4()})
    assert response.status_code == 404
