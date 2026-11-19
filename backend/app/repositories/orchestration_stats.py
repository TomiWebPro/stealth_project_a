"""Authoritative orchestration statistics repository.

Statistics are derived from the authoritative ``ORCHESTRATION_PLANS`` and
``ORCHESTRATION_RUNS`` stores on every call (like ``CollaborationStatsRepository``
and ``LineageStatsRepository``): there is no second index to drift and removing
the router leaves no collection behind.

Runs carry a ``plan_id`` rather than a project id, so per-project attribution is
a join back to the plan that created the run. ``by_stage`` is zero-filled over the
canonical orchestration stages so the wire shape is identical across the
in-memory and SQLite stores; ``by_project`` is sorted by descending plan count,
then run count, then project id for deterministic cross-backend ordering. An
unknown ``project_id`` raises ``NotFoundError`` so the shared 404 envelope is
used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/orchestrationStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from ..schemas.common import utcnow
from ..schemas.orchestration import (
    OrchestrationPlan,
    OrchestrationRun,
    OrchestrationStage,
)
from ..schemas.orchestration_stats import (
    OrchestrationProjectCount,
    OrchestrationStageCount,
    OrchestrationStats,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_STAGES = tuple(get_args(OrchestrationStage))


class OrchestrationStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> OrchestrationStats:
        """Build fresh orchestration metrics, optionally scoped to a project."""
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        plans = [
            plan
            for plan in self._load_all(Collections.ORCHESTRATION_PLANS, OrchestrationPlan)
            if project_id is None or plan.project_id == project_id
        ]
        plan_projects = {plan.plan_id: plan.project_id for plan in plans}
        runs = [
            run
            for run in self._load_all(Collections.ORCHESTRATION_RUNS, OrchestrationRun)
            if project_id is None or plan_projects.get(run.plan_id) == project_id
        ]

        stage_counts: Counter[str] = Counter(run.stage for run in runs)
        by_stage = [
            OrchestrationStageCount(stage=stage, count=stage_counts.get(stage, 0))
            for stage in _STAGES
        ]

        plans_by_project: Counter[UUID] = Counter(plan.project_id for plan in plans)
        runs_by_project: Counter[UUID] = Counter(
            plan_projects[run.plan_id]
            for run in runs
            if run.plan_id in plan_projects
        )
        project_ids = set(plans_by_project) | set(runs_by_project)
        # Most-planned projects first, with stable run-count and project-id
        # tie-breaks so memory and SQLite produce byte-identical ordering.
        by_project = [
            OrchestrationProjectCount(
                project_id=current_id,
                plans=plans_by_project.get(current_id, 0),
                runs=runs_by_project.get(current_id, 0),
            )
            for current_id in sorted(
                project_ids,
                key=lambda item: (
                    -plans_by_project.get(item, 0),
                    -runs_by_project.get(item, 0),
                    str(item),
                ),
            )
        ]

        # Recency ties are broken by the unique record key so the newest record is
        # identical on every backend.
        newest_plan = max(
            plans,
            key=lambda plan: (plan.created_at, str(plan.plan_id)),
            default=None,
        )
        newest_run = max(
            runs,
            key=lambda run: (run.created_at, str(run.run_id)),
            default=None,
        )

        return OrchestrationStats(
            total_plans=len(plans),
            total_runs=len(runs),
            total_steps=sum(len(plan.steps) for plan in plans),
            total_jobs_linked=sum(len(run.job_ids) for run in runs),
            by_stage=by_stage,
            by_project=by_project,
            newest_plan_at=newest_plan.created_at if newest_plan is not None else None,
            newest_run_at=newest_run.created_at if newest_run is not None else None,
            generated_at=self.clock(),
        )


__all__ = ["OrchestrationStatsRepository"]
