"""Authoritative single-orchestration-plan overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_STAGES = ["plan", "resolve", "submit", "await", "collect", "done"]
_KEYS = {
    "plan_id",
    "project_id",
    "project_name",
    "goal",
    "created_at",
    "counts",
    "by_stage",
    "recent_runs",
    "generated_at",
}
_COUNT_KEYS = {"steps", "runs", "jobs_linked"}
_RUN_KEYS = {"run_id", "stage", "job_count", "created_at"}


def _overview(client, plan_id, **params):
    return client.get(f"{PREFIX}/orchestration/plans/{plan_id}/overview", params=params)


def _store(client):
    return client.app.state.store


def _seed_project(client, name="Overview Orchestration"):
    from app.schemas.auth import Project
    from app.schemas.common import utcnow
    from app.storage.base import Collections

    now = utcnow()
    project = Project(
        id=uuid4(),
        org_id=uuid4(),
        name=name,
        created_by=uuid4(),
        created_at=now,
        updated_at=now,
    )
    _store(client).put(
        Collections.PROJECTS, str(project.id), project.model_dump(mode="json")
    )
    return project


def _seed_plan(client, project_id, *, plan_id=None, created_at=None, step_count=1, goal="Seeded plan"):
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
    _store(client).put(
        Collections.ORCHESTRATION_PLANS, str(plan_id), plan.model_dump(mode="json")
    )
    return plan


def _seed_run(client, plan_id, *, run_id=None, stage="plan", job_ids=None, created_at=None):
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
    _store(client).put(
        Collections.ORCHESTRATION_RUNS, str(run_id), run.model_dump(mode="json")
    )
    return run


def test_unknown_plan_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert set(response.json()) == {"error"}
    error = response.json()["error"]
    assert error["code"] == "plan_not_found"
    assert error["message"] and error["request_id"]
    assert response.headers.get("X-Request-ID")


def test_malformed_id_and_invalid_limit_use_shared_422_envelope(client):
    for params in (None, {"recent_limit": 0}, {"recent_limit": 51}):
        path = f"{PREFIX}/orchestration/plans/not-a-uuid/overview"
        response = client.get(path, params=params or {})
        assert response.status_code == 422
        assert set(response.json()) == {"error"}
        assert response.json()["error"]["code"] == "validation_error"
        assert response.headers.get("X-Request-ID")

    plan = _seed_plan(client, _seed_project(client).id)
    for bad_limit in (0, 51):
        response = _overview(client, plan.plan_id, recent_limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


def test_plan_overview_shape_counts_and_zero_filled_stages(client):
    project = _seed_project(client, "Planned Work")
    plan = _seed_plan(client, project.id, step_count=3, goal="Ship the thing")
    _seed_run(client, plan.plan_id, stage="plan", job_ids=[uuid4()])
    _seed_run(client, plan.plan_id, stage="done", job_ids=[uuid4(), uuid4()])

    response = _overview(client, plan.plan_id)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == _KEYS
    assert body["plan_id"] == str(plan.plan_id)
    assert body["project_id"] == str(project.id)
    assert body["project_name"] == project.name
    assert body["goal"] == "Ship the thing"
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {"steps": 3, "runs": 2, "jobs_linked": 3}
    assert body["by_stage"] == [
        {"stage": stage, "count": 1 if stage in {"plan", "done"} else 0}
        for stage in _STAGES
    ]
    assert response.headers.get("X-Request-ID")


def test_recent_runs_are_newest_first_and_bounded(client):
    from app.schemas.common import utcnow

    project = _seed_project(client)
    base = utcnow()
    runs = [
        _seed_run(
            client,
            uuid4(),  # orphan plan; must not appear
            created_at=base + timedelta(seconds=i),
        )
        for i in range(2)
    ]
    plan = _seed_plan(client, project.id, step_count=1)
    own_runs = [
        _seed_run(
            client,
            plan.plan_id,
            stage="submit",
            job_ids=[uuid4()] * (i + 1),
            created_at=base + timedelta(seconds=i),
        )
        for i in range(3)
    ]

    response = _overview(client, plan.plan_id, recent_limit=2)
    assert response.status_code == 200
    body = response.json()
    assert len(body["recent_runs"]) == 2
    assert set(body["recent_runs"][0]) == _RUN_KEYS
    # counts and stage buckets describe the whole plan, never the bounded page
    assert body["counts"] == {"steps": 1, "runs": 3, "jobs_linked": 6}
    assert sum(bucket["count"] for bucket in body["by_stage"]) == 3
    assert [entry["run_id"] for entry in body["recent_runs"]] == [
        str(own_runs[2].run_id),
        str(own_runs[1].run_id),
    ]
    assert [entry["job_count"] for entry in body["recent_runs"]] == [3, 2]
    # runs attached to a different plan are never attributed here
    assert all(entry["run_id"] != str(run.run_id) for run in runs for entry in body["recent_runs"])


def test_plan_without_runs_is_zero_filled(client):
    plan = _seed_plan(client, _seed_project(client).id, step_count=2, goal=None)
    body = _overview(client, plan.plan_id).json()
    assert body["goal"] is None
    assert body["counts"] == {"steps": 2, "runs": 0, "jobs_linked": 0}
    assert body["by_stage"] == [{"stage": stage, "count": 0} for stage in _STAGES]
    assert body["recent_runs"] == []


def test_missing_project_falls_back_to_stable_name(client):
    plan = _seed_plan(client, uuid4())  # no project written to the store
    body = _overview(client, plan.plan_id).json()
    assert body["project_name"] == "Unknown project"


def test_recent_limit_boundaries(client):
    from app.schemas.common import utcnow

    project = _seed_project(client)
    base = utcnow()
    plan = _seed_plan(client, project.id)
    for i in range(2):
        _seed_run(client, plan.plan_id, created_at=base + timedelta(seconds=i))

    tight = _overview(client, plan.plan_id, recent_limit=1)
    assert tight.status_code == 200
    assert len(tight.json()["recent_runs"]) == 1

    wide = _overview(client, plan.plan_id, recent_limit=50)
    assert wide.status_code == 200
    assert len(wide.json()["recent_runs"]) == 2
    assert wide.json()["counts"] == {"steps": 1, "runs": 2, "jobs_linked": 0}
