"""Authoritative orchestration-feed repository.

The feed is derived fresh from the ``ORCHESTRATION_PLANS`` and
``ORCHESTRATION_RUNS`` collections — the same stores the orchestration routers
write and ``OrchestrationStatsRepository`` aggregates — so it can never drift
from the snapshot. There is no persisted feed or second index; removing this
router leaves no collection behind.

Plans carry a project id directly. Runs carry only a ``plan_id``, so they are
joined back to their plan for project attribution; a run whose plan no longer
exists cannot be attributed and is excluded (matching the stats project-scope
join). Project display names are joined from the authoritative ``PROJECTS`` store
with a stable fallback. Ordering is by descending ``(created_at, kind, id)`` so
the newest plan/run comes first and ties are broken deterministically across the
in-memory and SQLite adapters. ``total`` counts the whole filtered feed before
the ``limit`` page is applied. An optional ``project_id`` scope validates the
project first so an unknown id uses the shared 404 envelope; the ``kind`` filter
and ``limit`` bounds are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/orchestrationFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.orchestration import OrchestrationPlan, OrchestrationRun
from ..schemas.orchestration_feed import OrchestrationFeed, OrchestrationFeedItem
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"


class OrchestrationFeedRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def feed(
        self,
        *,
        project_id: UUID | None = None,
        kind: str | None = None,
        limit: int = 50,
    ) -> OrchestrationFeed:
        """Build the newest-first orchestration feed with optional filters.

        An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
        envelope is used (same behaviour as the other project-scoped routers).
        ``total`` counts every item in scope before the ``limit`` page is applied.
        """
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        plans = self._load_all(Collections.ORCHESTRATION_PLANS, OrchestrationPlan)
        plan_projects = {plan.plan_id: plan.project_id for plan in plans}

        items: list[OrchestrationFeedItem] = []
        if kind in (None, "plan"):
            items.extend(self._plan_item(plan, project_names) for plan in plans)
        if kind in (None, "run"):
            for run in self._load_all(Collections.ORCHESTRATION_RUNS, OrchestrationRun):
                if run.plan_id not in plan_projects:
                    # Orphan run: no plan to attribute it to a project.
                    continue
                items.append(self._run_item(run, plan_projects, project_names))

        if project_id is not None:
            items = [item for item in items if item.project_id == project_id]

        # (created_at, kind, id) gives a deterministic newest-first order across
        # both storage adapters; the unique record id is the stable tie-break.
        items.sort(key=lambda item: (item.created_at, item.kind, str(item.id)), reverse=True)

        return OrchestrationFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )

    @staticmethod
    def _plan_item(
        plan: OrchestrationPlan,
        project_names: dict[UUID, str],
    ) -> OrchestrationFeedItem:
        return OrchestrationFeedItem(
            id=plan.plan_id,
            kind="plan",
            plan_id=plan.plan_id,
            run_id=None,
            project_id=plan.project_id,
            project_name=project_names.get(plan.project_id, _UNKNOWN_PROJECT_NAME),
            goal=plan.goal,
            stage=None,
            step_count=len(plan.steps),
            job_count=0,
            created_at=plan.created_at,
        )

    @staticmethod
    def _run_item(
        run: OrchestrationRun,
        plan_projects: dict[UUID, UUID],
        project_names: dict[UUID, str],
    ) -> OrchestrationFeedItem:
        project_id = plan_projects[run.plan_id]
        return OrchestrationFeedItem(
            id=run.run_id,
            kind="run",
            plan_id=run.plan_id,
            run_id=run.run_id,
            project_id=project_id,
            project_name=project_names.get(project_id, _UNKNOWN_PROJECT_NAME),
            goal=None,
            stage=run.stage,
            step_count=0,
            job_count=len(run.job_ids),
            created_at=run.created_at,
        )


__all__ = ["OrchestrationFeedRepository", "_UNKNOWN_PROJECT_NAME"]
