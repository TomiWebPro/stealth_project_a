"""Authoritative single-orchestration-plan overview repository.

The snapshot is derived fresh from the ``ORCHESTRATION_PLANS`` and
``ORCHESTRATION_RUNS`` collections — the same stores the orchestration routers
write, ``OrchestrationStatsRepository`` aggregates and ``OrchestrationFeedRepository``
reads — with the project display name joined from the authoritative project store.
There is no second index to drift and removing the router leaves no collection
behind.

The ``by_stage`` breakdown reuses the exact derivation
``OrchestrationStatsRepository`` uses (zero-filled over the canonical stages), so
the overview can never disagree with that view. ``recent_runs`` is a bounded
newest-first projection of the plan's runs with a deterministic id tie-break;
``counts`` is never bounded. Runs are joined to the requested plan id, so orphan
runs belonging to a missing plan are never attributed. An unknown plan raises
``NotFoundError`` for the shared 404 ``plan_not_found`` envelope; the
``recent_limit`` bound is validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/planOverview.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from ..errors import NotFoundError
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.orchestration import (
    OrchestrationPlan,
    OrchestrationRun,
    OrchestrationStage,
)
from ..schemas.orchestration_stats import OrchestrationStageCount
from ..schemas.plan_overview import (
    PlanOverview,
    PlanOverviewCounts,
    PlanOverviewRunRef,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"
_STAGES = tuple(get_args(OrchestrationStage))


class PlanOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def overview(self, plan_id: UUID, *, recent_limit: int = 5) -> PlanOverview:
        """Build a fresh snapshot for one orchestration plan."""
        plan = next(
            (
                candidate
                for candidate in self._load_all(
                    Collections.ORCHESTRATION_PLANS, OrchestrationPlan
                )
                if candidate.plan_id == plan_id
            ),
            None,
        )
        if plan is None:
            raise NotFoundError("Orchestration plan", str(plan_id), code="plan_not_found")

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }
        runs = [
            run
            for run in self._load_all(Collections.ORCHESTRATION_RUNS, OrchestrationRun)
            if run.plan_id == plan_id
        ]

        stage_counts: Counter[str] = Counter(run.stage for run in runs)
        by_stage = [
            OrchestrationStageCount(stage=stage, count=stage_counts.get(stage, 0))
            for stage in _STAGES
        ]

        # (created_at, run_id) gives a deterministic newest-first order across
        # both storage adapters; the unique run id is the stable tie-break.
        runs.sort(key=lambda run: (run.created_at, str(run.run_id)), reverse=True)
        recent_runs = [
            PlanOverviewRunRef(
                run_id=run.run_id,
                stage=run.stage,
                job_count=len(run.job_ids),
                created_at=run.created_at,
            )
            for run in runs[:recent_limit]
        ]

        return PlanOverview(
            plan_id=plan.plan_id,
            project_id=plan.project_id,
            project_name=project_names.get(plan.project_id, _UNKNOWN_PROJECT_NAME),
            goal=plan.goal,
            created_at=plan.created_at,
            counts=PlanOverviewCounts(
                steps=len(plan.steps),
                runs=len(runs),
                jobs_linked=sum(len(run.job_ids) for run in runs),
            ),
            by_stage=by_stage,
            recent_runs=recent_runs,
            generated_at=self.clock(),
        )


__all__ = ["PlanOverviewRepository", "_UNKNOWN_PROJECT_NAME"]
