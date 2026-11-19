"""Authoritative orchestration statistics endpoint tests (success + failure)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_STAGES = ["plan", "resolve", "submit", "await", "collect", "done"]
_KEYS = {
    "total_plans",
    "total_runs",
    "total_steps",
    "total_jobs_linked",
    "by_stage",
    "by_project",
    "newest_plan_at",
    "newest_run_at",
    "generated_at",
}


def _stats(client, **params):
    return client.get(f"{PREFIX}/orchestration/stats", params=params)


def _clear(client):
    client.app.state.store.clear()


def _project(client, name="Orchestration Project"):
    response = client.post(f"{PREFIX}/projects", json={"name": name})
    assert response.status_code == 201
    return response.json()


def _seed_plan(client, project_id, *, plan_id=None, created_at=None, step_count=1):
    """Write an OrchestrationPlan straight to the authoritative store."""
    from app.schemas.common import utcnow
    from app.schemas.orchestration import OrchestrationPlan, OrchestrationPlanStep
    from app.storage.base import Collections

    plan_id = plan_id or uuid4()
    plan = OrchestrationPlan(
        plan_id=plan_id,
        project_id=project_id,
        goal="Seeded plan",
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


def test_orchestration_stats_empty_store_is_zero_filled(client):
    _clear(client)

    response = _stats(client)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"]

    body = response.json()
    assert set(body) == _KEYS
    assert body["total_plans"] == 0
    assert body["total_runs"] == 0
    assert body["total_steps"] == 0
    assert body["total_jobs_linked"] == 0
    assert body["by_stage"] == [{"stage": s, "count": 0} for s in _STAGES]
    assert body["by_project"] == []
    assert body["newest_plan_at"] is None
    assert body["newest_run_at"] is None
    assert body["generated_at"]


def test_orchestration_stats_derives_totals_breakdowns_and_recency(client):
    from app.schemas.common import utcnow

    _clear(client)
    now = utcnow()
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]

    plan1 = _seed_plan(client, p1, step_count=2, created_at=now - timedelta(hours=3))
    _seed_plan(client, p1, step_count=1, created_at=now - timedelta(hours=2))
    newest_plan = _seed_plan(client, p2, step_count=3, created_at=now - timedelta(hours=1))

    _seed_run(
        client,
        plan1.plan_id,
        stage="plan",
        job_ids=[uuid4(), uuid4()],
        created_at=now - timedelta(hours=3),
    )
    _seed_run(client, plan1.plan_id, stage="done", created_at=now - timedelta(hours=2))
    newest_run = _seed_run(
        client,
        newest_plan.plan_id,
        stage="submit",
        job_ids=[uuid4()],
        created_at=now - timedelta(hours=1),
    )

    body = _stats(client).json()
    assert body["total_plans"] == 3
    assert body["total_runs"] == 3
    assert body["total_steps"] == 6  # 2 + 1 + 3
    assert body["total_jobs_linked"] == 3  # 2 + 0 + 1
    assert body["by_stage"] == [
        {"stage": "plan", "count": 1},
        {"stage": "resolve", "count": 0},
        {"stage": "submit", "count": 1},
        {"stage": "await", "count": 0},
        {"stage": "collect", "count": 0},
        {"stage": "done", "count": 1},
    ]
    # p1 has 2 plans + 2 runs; p2 has 1 plan + 1 run.
    assert body["by_project"] == [
        {"project_id": p1, "plans": 2, "runs": 2},
        {"project_id": p2, "plans": 1, "runs": 1},
    ]
    assert body["newest_plan_at"] == newest_plan.created_at.isoformat().replace(
        "+00:00", "Z"
    )
    assert body["newest_run_at"] == newest_run.created_at.isoformat().replace("+00:00", "Z")


def test_orchestration_stats_project_scope_unknown_and_malformed(client):
    _clear(client)
    p1 = _project(client, "P1")["id"]
    p2 = _project(client, "P2")["id"]
    plan1 = _seed_plan(client, p1, step_count=2)
    _seed_run(client, plan1.plan_id, stage="plan", job_ids=[uuid4()])
    plan2 = _seed_plan(client, p2, step_count=1)
    _seed_run(client, plan2.plan_id, stage="done")
    _seed_run(client, plan2.plan_id, stage="resolve")

    scoped = _stats(client, project_id=p1)
    assert scoped.status_code == 200
    body = scoped.json()
    assert body["total_plans"] == 1
    assert body["total_runs"] == 1
    assert body["total_steps"] == 2
    assert body["total_jobs_linked"] == 1
    assert body["by_project"] == [{"project_id": p1, "plans": 1, "runs": 1}]

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


def test_orchestration_stats_by_project_tie_break_is_deterministic(client):
    _clear(client)
    p1 = _project(client, "A")["id"]
    p2 = _project(client, "B")["id"]
    # Identical activity for both projects: ordering falls through to project id.
    for project_id in (p1, p2):
        plan = _seed_plan(client, project_id, step_count=1)
        _seed_run(client, plan.plan_id, stage="plan")

    body = _stats(client).json()
    assert body["by_project"] == [
        {"project_id": pid, "plans": 1, "runs": 1} for pid in sorted([p1, p2])
    ]


def test_orchestration_stats_excludes_orphan_runs_from_project_attribution(client):
    _clear(client)
    p = _project(client)["id"]
    plan = _seed_plan(client, p, step_count=1)
    _seed_run(client, plan.plan_id, stage="plan")
    # A run whose plan is missing is still counted globally but has no project.
    orphan = _seed_run(client, uuid4(), stage="await")

    body = _stats(client).json()
    assert body["total_plans"] == 1
    assert body["total_runs"] == 2
    assert body["by_stage"][0] == {"stage": "plan", "count": 1}
    assert body["by_stage"][3] == {"stage": "await", "count": 1}
    # Only the attributed run lands in by_project; the orphan is excluded.
    assert body["by_project"] == [{"project_id": p, "plans": 1, "runs": 1}]
    assert orphan.run_id  # sanity: the orphan was actually seeded


def test_orchestration_stats_reflects_api_created_plans_and_runs(client):
    _clear(client)
    p = _project(client)["id"]

    plan_response = client.post(
        f"{PREFIX}/orchestration/plans",
        json={"project_id": p, "goal": "make a video with a lora"},
    )
    assert plan_response.status_code == 201
    run_response = client.post(
        f"{PREFIX}/orchestration/runs",
        json={"project_id": p, "goal": "just say hello"},
    )
    assert run_response.status_code == 201

    body = _stats(client).json()
    assert body["total_plans"] == 2
    assert body["total_runs"] == 1
    assert body["total_jobs_linked"] == 0
    assert body["by_stage"][0] == {"stage": "plan", "count": 1}
    assert body["by_project"] == [{"project_id": p, "plans": 2, "runs": 1}]


def test_orchestration_stats_is_derived_live_from_the_store(client):
    from app.storage.base import Collections

    _clear(client)
    p = _project(client)["id"]
    assert _stats(client).json()["total_plans"] == 0

    plan = _seed_plan(client, p, step_count=2)
    run = _seed_run(client, plan.plan_id, stage="resolve", job_ids=[uuid4()])
    first = _stats(client).json()
    assert first["total_plans"] == 1
    assert first["total_runs"] == 1
    assert first["total_steps"] == 2
    assert first["total_jobs_linked"] == 1
    assert first["by_stage"][1] == {"stage": "resolve", "count": 1}

    client.app.state.store.delete(Collections.ORCHESTRATION_PLANS, str(plan.plan_id))
    client.app.state.store.delete(Collections.ORCHESTRATION_RUNS, str(run.run_id))
    second = _stats(client).json()
    assert second["total_plans"] == 0
    assert second["total_runs"] == 0
    assert second["total_steps"] == 0
    assert second["total_jobs_linked"] == 0
    assert second["by_stage"] == [{"stage": s, "count": 0} for s in _STAGES]
    assert second["by_project"] == []
    assert second["newest_plan_at"] is None
    assert second["newest_run_at"] is None
