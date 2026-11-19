"""Authoritative orchestration-feed endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_KEYS = {"items", "total", "generated_at"}
_ITEM_KEYS = {
    "id",
    "kind",
    "plan_id",
    "run_id",
    "project_id",
    "project_name",
    "goal",
    "stage",
    "step_count",
    "job_count",
    "created_at",
}


def _feed(client, **params):
    return client.get(f"{PREFIX}/orchestration/feed", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Orchestration Feed Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_plan(client, project_id, *, plan_id=None, created_at=None, step_count=1, goal="Seeded plan"):
    """Write an OrchestrationPlan straight to the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.orchestration import OrchestrationPlan, OrchestrationPlanStep
    from app.storage.base import Collections

    plan_id = plan_id or uuid4()
    plan = OrchestrationPlan(
        plan_id=plan_id,
        project_id=project_id,
        goal=goal,
        steps=[
            OrchestrationPlanStep(step_id=f"step_{i:02d}", operation_id="text-to-text")
            for i in range(1, step_count + 1)
        ],
        created_at=created_at or utcnow(),
    )
    client.app.state.store.put(
        Collections.ORCHESTRATION_PLANS, str(plan_id), plan.model_dump(mode="json")
    )
    return plan


def _seed_run(client, plan_id, *, run_id=None, stage="plan", job_ids=None, created_at=None):
    """Write an OrchestrationRun straight to the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.orchestration import OrchestrationRun
    from app.storage.base import Collections

    run_id = run_id or uuid4()
    run = OrchestrationRun(
        run_id=run_id,
        plan_id=plan_id,
        stage=stage,
        job_ids=job_ids or [],
        created_at=created_at or utcnow(),
    )
    client.app.state.store.put(
        Collections.ORCHESTRATION_RUNS, str(run_id), run.model_dump(mode="json")
    )
    return run


def _sorted_desc(items):
    return items == sorted(
        items,
        key=lambda item: (item["created_at"], item["kind"], item["id"]),
        reverse=True,
    )


def test_orchestration_feed_empty_store_is_zero_filled(client):
    _clear(client)

    response = _feed(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total"] == 0
    assert body["items"] == []
    assert body["generated_at"]


def test_orchestration_feed_is_newest_first_with_joins_and_fields(client):
    from app.schemas.common import utcnow

    _clear(client)
    now = utcnow()
    alpha = _project(client, name="Alpha")
    beta = _project(client, name="Beta")

    plan = _seed_plan(
        client, alpha["id"], step_count=2, goal="Make a video",
        created_at=now - timedelta(hours=3),
    )
    run = _seed_run(
        client, plan.plan_id, stage="submit", job_ids=[uuid4(), uuid4()],
        created_at=now - timedelta(hours=2),
    )
    _seed_plan(client, beta["id"], step_count=1, created_at=now - timedelta(hours=1))

    body = _feed(client).json()
    assert set(body) == _KEYS
    assert body["total"] == 3
    items = body["items"]
    assert len(items) == 3
    assert _sorted_desc(items)
    for item in items:
        assert set(item) == _ITEM_KEYS

    by_id = {item["id"]: item for item in items}
    plan_item = by_id[str(plan.plan_id)]
    assert plan_item["kind"] == "plan"
    assert plan_item["plan_id"] == str(plan.plan_id)
    assert plan_item["run_id"] is None
    assert plan_item["project_id"] == alpha["id"]
    assert plan_item["project_name"] == "Alpha"
    assert plan_item["goal"] == "Make a video"
    assert plan_item["stage"] is None
    assert plan_item["step_count"] == 2
    assert plan_item["job_count"] == 0

    run_item = by_id[str(run.run_id)]
    assert run_item["kind"] == "run"
    assert run_item["plan_id"] == str(plan.plan_id)
    assert run_item["run_id"] == str(run.run_id)
    assert run_item["project_id"] == alpha["id"]
    assert run_item["project_name"] == "Alpha"
    assert run_item["goal"] is None
    assert run_item["stage"] == "submit"
    assert run_item["step_count"] == 0
    assert run_item["job_count"] == 2


def test_orchestration_feed_project_scope_narrows_derivation(client):
    _clear(client)
    alpha = _project(client, name="Alpha")
    beta = _project(client, name="Beta")
    plan_a = _seed_plan(client, alpha["id"])
    _seed_run(client, plan_a.plan_id, stage="done")
    _seed_plan(client, beta["id"])

    scoped = _feed(client, project_id=alpha["id"]).json()
    assert scoped["total"] == 2
    assert {item["kind"] for item in scoped["items"]} == {"plan", "run"}
    assert all(item["project_name"] == "Alpha" for item in scoped["items"])

    assert _feed(client).json()["total"] == 3
    assert _feed(client, project_id=beta["id"]).json()["total"] == 1


def test_orchestration_feed_kind_filter(client):
    _clear(client)
    project_id = _project(client)["id"]
    plan = _seed_plan(client, project_id)
    _seed_run(client, plan.plan_id, stage="resolve")
    _seed_run(client, plan.plan_id, stage="done")

    plans = _feed(client, kind="plan").json()
    assert plans["total"] == 1
    assert all(item["kind"] == "plan" for item in plans["items"])

    runs = _feed(client, kind="run").json()
    assert runs["total"] == 2
    assert all(item["kind"] == "run" for item in runs["items"])
    assert _feed(client).json()["total"] == 3


def test_orchestration_feed_unknown_project_uses_shared_404_envelope(client):
    _clear(client)
    response = _feed(client, project_id=uuid4())
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "project_not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_orchestration_feed_limit_bounds_page_but_not_total(client):
    _clear(client)
    project_id = _project(client)["id"]
    for _ in range(4):
        _seed_plan(client, project_id)

    body = _feed(client, limit=2).json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert _sorted_desc(body["items"])


def test_orchestration_feed_excludes_orphan_runs(client):
    _clear(client)
    project_id = _project(client)["id"]
    plan = _seed_plan(client, project_id)
    _seed_run(client, plan.plan_id, stage="plan")
    # A run whose plan is missing cannot be attributed to a project.
    _seed_run(client, uuid4(), stage="await")

    body = _feed(client).json()
    assert body["total"] == 2
    assert all(item["kind"] != "run" or item["stage"] != "await" for item in body["items"])


def test_orchestration_feed_reflects_api_created_plans_and_runs(client):
    _clear(client)
    project_id = _project(client)["id"]
    plan_response = client.post(
        f"{PREFIX}/orchestration/plans",
        json={"project_id": project_id, "goal": "make a video with a lora"},
    )
    assert plan_response.status_code == 201
    run_response = client.post(
        f"{PREFIX}/orchestration/runs",
        json={"project_id": project_id, "goal": "just say hello"},
    )
    assert run_response.status_code == 201

    # POST /orchestration/plans writes one plan; POST /orchestration/runs runs the
    # deterministic planner (a second plan) and records one run — 3 items total.
    body = _feed(client).json()
    assert body["total"] == 3
    assert {item["kind"] for item in body["items"]} == {"plan", "run"}


def test_orchestration_feed_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    _clear(client)
    project_id = _project(client)["id"]
    assert _feed(client).json()["total"] == 0

    plan = _seed_plan(client, project_id)
    run = _seed_run(client, plan.plan_id)
    assert _feed(client).json()["total"] == 2

    client.app.state.store.delete(Collections.ORCHESTRATION_PLANS, str(plan.plan_id))
    client.app.state.store.delete(Collections.ORCHESTRATION_RUNS, str(run.run_id))
    assert _feed(client).json()["total"] == 0


def test_orchestration_feed_malformed_project_id_uses_shared_422_envelope(client):
    _clear(client)
    response = _feed(client, project_id="not-a-uuid")
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["request_id"] == response.headers["X-Request-ID"]


def test_orchestration_feed_invalid_kind_uses_shared_422_envelope(client):
    _clear(client)
    response = _feed(client, kind="chain")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert response.headers["X-Request-ID"]


def test_orchestration_feed_invalid_limit_uses_shared_422_envelope(client):
    _clear(client)
    for bad_limit in (0, 201):
        response = _feed(client, limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"
