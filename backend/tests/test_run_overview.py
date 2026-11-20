"""Authoritative single-orchestration-run overview endpoint tests (success + failure paths)."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from .conftest import PREFIX

_STATUSES = ["queued", "running", "succeeded", "failed", "canceled"]
_KEYS = {
    "run_id",
    "plan_id",
    "project_id",
    "project_name",
    "plan_goal",
    "stage",
    "created_at",
    "counts",
    "by_status",
    "recent_jobs",
    "generated_at",
}
_COUNT_KEYS = {"jobs_linked", "jobs_resolved", "plan_steps"}
_JOB_KEYS = {"job_id", "operation_id", "status", "progress", "created_at"}


def _overview(client, run_id, **params):
    return client.get(f"{PREFIX}/orchestration/runs/{run_id}/overview", params=params)


def _store(client):
    return client.app.state.store


def _seed_project(client, name="Run Overview Project"):
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


def _seed_job(client, project_id, *, job_id=None, status="queued", progress=0.0, created_at=None):
    from app.schemas.common import utcnow
    from app.schemas.operation import Job
    from app.storage.base import Collections

    job_id = job_id or uuid4()
    job = Job(
        id=job_id,
        project_id=project_id,
        operation_id="text-to-image",
        schema_version="1.0.0",
        status=status,
        progress=progress,
        created_by=uuid4(),
        created_at=created_at or utcnow(),
    )
    _store(client).put(Collections.JOBS, str(job_id), job.model_dump(mode="json"))
    return job


def test_unknown_run_uses_shared_404_envelope(client):
    response = _overview(client, uuid4())
    assert response.status_code == 404
    assert set(response.json()) == {"error"}
    error = response.json()["error"]
    assert error["code"] == "run_not_found"
    assert error["message"] and error["request_id"]
    assert response.headers.get("X-Request-ID")


def test_malformed_id_and_invalid_limit_use_shared_422_envelope(client):
    for params in (None, {"recent_limit": 0}, {"recent_limit": 51}):
        path = f"{PREFIX}/orchestration/runs/not-a-uuid/overview"
        response = client.get(path, params=params or {})
        assert response.status_code == 422
        assert set(response.json()) == {"error"}
        assert response.json()["error"]["code"] == "validation_error"
        assert response.headers.get("X-Request-ID")

    run = _seed_run(client, uuid4())
    for bad_limit in (0, 51):
        response = _overview(client, run.run_id, recent_limit=bad_limit)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "validation_error"


def test_run_overview_shape_counts_and_zero_filled_statuses(client):
    project = _seed_project(client, "Planned Work")
    plan = _seed_plan(client, project.id, step_count=3, goal="Ship the thing")
    jobs = [
        _seed_job(client, project.id, status="succeeded"),
        _seed_job(client, project.id, status="failed"),
    ]
    run = _seed_run(
        client, plan.plan_id, stage="done", job_ids=[job.id for job in jobs]
    )

    response = _overview(client, run.run_id)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == _KEYS
    assert body["run_id"] == str(run.run_id)
    assert body["plan_id"] == str(plan.plan_id)
    assert body["project_id"] == str(project.id)
    assert body["project_name"] == project.name
    assert body["plan_goal"] == "Ship the thing"
    assert body["stage"] == "done"
    assert set(body["counts"]) == _COUNT_KEYS
    assert body["counts"] == {"jobs_linked": 2, "jobs_resolved": 2, "plan_steps": 3}
    assert body["by_status"] == [
        {"status": status, "count": 1 if status in {"succeeded", "failed"} else 0}
        for status in _STATUSES
    ]
    assert response.headers.get("X-Request-ID")


def test_recent_jobs_are_newest_first_bounded_and_deduped(client):
    from app.schemas.common import utcnow

    project = _seed_project(client)
    base = utcnow()
    jobs = [
        _seed_job(
            client,
            project.id,
            status="running",
            progress=0.25 * (i + 1),
            created_at=base + timedelta(seconds=i),
        )
        for i in range(3)
    ]
    plan = _seed_plan(client, project.id)
    run = _seed_run(
        client,
        plan.plan_id,
        stage="submit",
        # ledger repeated entries + a missing job id
        job_ids=[jobs[0].id, jobs[1].id, jobs[2].id, jobs[0].id, uuid4()],
    )

    body = _overview(client, run.run_id, recent_limit=2).json()
    assert body["counts"] == {"jobs_linked": 4, "jobs_resolved": 3, "plan_steps": 1}
    assert len(body["recent_jobs"]) == 2
    assert set(body["recent_jobs"][0]) == _JOB_KEYS
    assert [entry["job_id"] for entry in body["recent_jobs"]] == [
        str(jobs[2].id),
        str(jobs[1].id),
    ]
    assert [entry["progress"] for entry in body["recent_jobs"]] == [0.75, 0.5]
    # every status bucket describes the whole resolved set, never the bounded page
    assert sum(bucket["count"] for bucket in body["by_status"]) == 3


def test_run_without_resolvable_jobs_is_zero_filled(client):
    plan = _seed_plan(client, _seed_project(client).id, step_count=2)
    run = _seed_run(client, plan.plan_id, stage="await", job_ids=[uuid4()])

    body = _overview(client, run.run_id).json()
    assert body["counts"] == {"jobs_linked": 1, "jobs_resolved": 0, "plan_steps": 2}
    assert body["by_status"] == [{"status": status, "count": 0} for status in _STATUSES]
    assert body["recent_jobs"] == []


def test_orphan_run_without_plan_uses_stable_fallbacks(client):
    run = _seed_run(client, uuid4(), stage="plan")
    body = _overview(client, run.run_id).json()
    assert body["project_id"] is None
    assert body["project_name"] == "Unknown project"
    assert body["plan_goal"] is None
    assert body["counts"] == {"jobs_linked": 0, "jobs_resolved": 0, "plan_steps": 0}


def test_missing_project_falls_back_to_stable_name(client):
    plan = _seed_plan(client, uuid4())  # no project written to the store
    run = _seed_run(client, plan.plan_id)
    body = _overview(client, run.run_id).json()
    assert body["project_id"] == str(plan.project_id)
    assert body["project_name"] == "Unknown project"


def test_recent_limit_boundaries(client):
    from app.schemas.common import utcnow

    project = _seed_project(client)
    base = utcnow()
    plan = _seed_plan(client, project.id)
    jobs = [
        _seed_job(client, project.id, created_at=base + timedelta(seconds=i))
        for i in range(2)
    ]
    run = _seed_run(client, plan.plan_id, job_ids=[job.id for job in jobs])

    tight = _overview(client, run.run_id, recent_limit=1)
    assert tight.status_code == 200
    assert len(tight.json()["recent_jobs"]) == 1

    wide = _overview(client, run.run_id, recent_limit=50)
    assert wide.status_code == 200
    assert len(wide.json()["recent_jobs"]) == 2
    assert wide.json()["counts"] == {"jobs_linked": 2, "jobs_resolved": 2, "plan_steps": 1}
