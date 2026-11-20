"""Authoritative single-orchestration-run overview repository.

The snapshot is derived fresh from the ``ORCHESTRATION_RUNS`` collection — the
same store the orchestration routers write, ``OrchestrationStatsRepository``
aggregates and ``OrchestrationFeedRepository`` reads — with the parent plan
joined from ``ORCHESTRATION_PLANS``, the project display name from the
authoritative project store and linked jobs from ``JOBS``. There is no second
index to drift and removing the router leaves no collection behind.

The ``by_status`` breakdown reuses the exact canonical status set
``JobStatsRepository`` zero-fills over, so the overview can never disagree with
that view. ``recent_jobs`` is a bounded newest-first projection of the run's
linked jobs with a deterministic id tie-break; ``counts`` is never bounded.
Job ids that do not resolve to an authoritative job are skipped (the ledger
count still includes them), and duplicate ledger entries collapse. An unknown
run raises ``NotFoundError`` for the shared 404 ``run_not_found`` envelope; the
``recent_limit`` bound is validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/runOverview.ts`` contracts.
"""

from __future__ import annotations

from typing import get_args
from uuid import UUID

from ..errors import NotFoundError
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.job_stats import JobStatusCount
from ..schemas.operation import Job, JobStatus
from ..schemas.orchestration import OrchestrationPlan, OrchestrationRun
from ..schemas.run_overview import (
    RunOverview,
    RunOverviewCounts,
    RunOverviewJobRef,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"
_STATUSES = tuple(get_args(JobStatus))


class RunOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def overview(self, run_id: UUID, *, recent_limit: int = 5) -> RunOverview:
        """Build a fresh snapshot for one orchestration run."""
        run = next(
            (
                candidate
                for candidate in self._load_all(
                    Collections.ORCHESTRATION_RUNS, OrchestrationRun
                )
                if candidate.run_id == run_id
            ),
            None,
        )
        if run is None:
            raise NotFoundError("Orchestration run", str(run_id), code="run_not_found")

        plan = next(
            (
                candidate
                for candidate in self._load_all(
                    Collections.ORCHESTRATION_PLANS, OrchestrationPlan
                )
                if candidate.plan_id == run.plan_id
            ),
            None,
        )
        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }
        jobs_by_id = {
            job.id: job for job in self._load_all(Collections.JOBS, Job)
        }

        # The ledger is append-only: collapse duplicate ids but keep the count of
        # declared links (``jobs_linked``) separate from resolved jobs.
        linked_ids = list(dict.fromkeys(run.job_ids))
        linked_jobs = [jobs_by_id[job_id] for job_id in linked_ids if job_id in jobs_by_id]

        status_counts: dict[str, int] = {status: 0 for status in _STATUSES}
        for job in linked_jobs:
            status_counts[job.status] = status_counts.get(job.status, 0) + 1
        by_status = [
            JobStatusCount(status=status, count=status_counts.get(status, 0))
            for status in _STATUSES
        ]

        # (created_at, job id) gives a deterministic newest-first order across
        # both storage adapters; the unique job id is the stable tie-break.
        linked_jobs.sort(key=lambda job: (job.created_at, str(job.id)), reverse=True)
        recent_jobs = [
            RunOverviewJobRef(
                job_id=job.id,
                operation_id=job.operation_id,
                status=job.status,
                progress=job.progress,
                created_at=job.created_at,
            )
            for job in linked_jobs[:recent_limit]
        ]

        project_id = plan.project_id if plan else None
        return RunOverview(
            run_id=run.run_id,
            plan_id=run.plan_id,
            project_id=project_id,
            project_name=(
                project_names.get(project_id, _UNKNOWN_PROJECT_NAME)
                if project_id is not None
                else _UNKNOWN_PROJECT_NAME
            ),
            plan_goal=plan.goal if plan else None,
            stage=run.stage,
            created_at=run.created_at,
            counts=RunOverviewCounts(
                jobs_linked=len(linked_ids),
                jobs_resolved=len(linked_jobs),
                plan_steps=len(plan.steps) if plan else 0,
            ),
            by_status=by_status,
            recent_jobs=recent_jobs,
            generated_at=self.clock(),
        )


__all__ = ["RunOverviewRepository", "_UNKNOWN_PROJECT_NAME"]
