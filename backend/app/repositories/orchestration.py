"""Orchestration, collaboration and storage-stat repository.

Plans are produced by a deterministic local planner (the LLM/orchestration layer
is not the source of truth). Runs are recorded alongside presence so the actor
who starts a run is automatically marked online for that project.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from ..catalog import get_operation_spec
from ..errors import InvalidRequestError, NotFoundError
from ..schemas.asset import Asset
from ..schemas.common import utcnow
from ..schemas.orchestration import (
    Comment,
    OrchestrationPlan,
    OrchestrationPlanStep,
    OrchestrationRun,
    OrchestrationRunRequest,
    Presence,
    PresenceState,
    StorageQuota,
    StorageStats,
)
from ..storage.base import Collections, DocumentStore
from .assets import AssetRepository
from .base import BaseRepository
from .projects import ProjectRepository

# Keyword -> operation, evaluated in order; keeps the local planner predictable.
_PLAN_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("video", "image-to-video"),
    ("lora", "lora-train"),
    ("train", "lora-train"),
    ("splat", "splat-train"),
    ("3d", "splat-train"),
    ("image", "text-to-image"),
    ("picture", "text-to-image"),
)


class OrchestrationRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        assets: AssetRepository,
        *,
        storage_quota_bytes: int,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects
        self.assets = assets
        self.storage_quota_bytes = storage_quota_bytes

    # --- Plans ---------------------------------------------------------------

    def _plan_steps(self, goal: str) -> list[OrchestrationPlanStep]:
        lowered = goal.lower()
        operation_ids: list[str] = []
        for keyword, operation_id in _PLAN_KEYWORDS:
            if keyword in lowered and operation_id not in operation_ids:
                operation_ids.append(operation_id)
        if not operation_ids:
            operation_ids = ["text-to-text"]

        steps: list[OrchestrationPlanStep] = []
        for index, operation_id in enumerate(operation_ids, start=1):
            if get_operation_spec(operation_id) is None:
                continue  # never emit a step the catalog cannot execute
            steps.append(
                OrchestrationPlanStep(
                    step_id=f"step_{index:02d}",
                    operation_id=operation_id,
                    depends_on=[f"step_{index - 1:02d}"] if index > 1 else [],
                    settings={},
                )
            )
        return steps

    def create_plan(self, payload: OrchestrationRunRequest) -> OrchestrationPlan:
        project = self.projects.get_or_raise(payload.project_id)
        if project.archived:
            raise InvalidRequestError(
                f"Project '{project.id}' is archived; plans cannot be created.",
                code="project_archived",
            )
        plan = OrchestrationPlan(
            plan_id=uuid4(),
            project_id=payload.project_id,
            goal=payload.goal,
            steps=self._plan_steps(payload.goal),
            created_at=self.clock(),
        )
        self._save(Collections.ORCHESTRATION_PLANS, str(plan.plan_id), plan)
        return plan

    def get_plan(self, plan_id: UUID) -> OrchestrationPlan | None:
        return self._load(Collections.ORCHESTRATION_PLANS, str(plan_id), OrchestrationPlan)

    def get_plan_or_raise(self, plan_id: UUID) -> OrchestrationPlan:
        plan = self.get_plan(plan_id)
        if plan is None:
            raise NotFoundError("Plan", str(plan_id))
        return plan

    def list_plans(self, project_id: UUID | None = None) -> list[OrchestrationPlan]:
        plans = self._load_all(Collections.ORCHESTRATION_PLANS, OrchestrationPlan)
        if project_id is not None:
            plans = [plan for plan in plans if plan.project_id == project_id]
        plans.sort(key=lambda plan: (plan.created_at, str(plan.plan_id)), reverse=True)
        return plans

    # --- Runs ----------------------------------------------------------------

    def create_run(
        self, payload: OrchestrationRunRequest, *, user_id: UUID
    ) -> OrchestrationRun:
        plan = self.create_plan(payload)
        run = OrchestrationRun(
            run_id=uuid4(),
            plan_id=plan.plan_id,
            stage="plan",
            job_ids=[],
            created_at=self.clock(),
        )
        self._save(Collections.ORCHESTRATION_RUNS, str(run.run_id), run)
        # Starting a run marks the actor online for the project.
        self.upsert_presence(payload.project_id, user_id, "online")
        return run

    def get_run(self, run_id: UUID) -> OrchestrationRun | None:
        return self._load(Collections.ORCHESTRATION_RUNS, str(run_id), OrchestrationRun)

    def get_run_or_raise(self, run_id: UUID) -> OrchestrationRun:
        run = self.get_run(run_id)
        if run is None:
            raise NotFoundError("Run", str(run_id))
        return run

    # --- Presence ------------------------------------------------------------

    def upsert_presence(
        self,
        project_id: UUID,
        user_id: UUID,
        state: PresenceState,
        *,
        last_seen_at=None,
    ) -> Presence:
        self.projects.get_or_raise(project_id)
        presence = Presence(
            user_id=user_id,
            project_id=project_id,
            state=state,
            last_seen_at=last_seen_at or self.clock(),
        )
        self._save(Collections.PRESENCE, f"{project_id}:{user_id}", presence)
        return presence

    def list_presence(self, project_id: UUID) -> list[Presence]:
        self.projects.get_or_raise(project_id)
        people = [
            presence
            for presence in self._load_all(Collections.PRESENCE, Presence)
            if presence.project_id == project_id
        ]
        people.sort(key=lambda p: (p.last_seen_at, str(p.user_id)), reverse=True)
        return people

    # --- Comments ------------------------------------------------------------

    def add_comment(
        self,
        project_id: UUID,
        body: str,
        *,
        author_id: UUID,
        asset_id: UUID | None = None,
    ) -> Comment:
        self.projects.get_or_raise(project_id)
        if asset_id is not None:
            asset = self.assets.get(asset_id)
            if asset is None or asset.project_id != project_id:
                raise InvalidRequestError(
                    f"Asset '{asset_id}' does not belong to project '{project_id}'.",
                    code="invalid_asset",
                    details=[("asset_id", "must reference an asset in this project")],
                )
        comment = Comment(
            id=uuid4(),
            project_id=project_id,
            asset_id=asset_id,
            author_id=author_id,
            body=body,
            created_at=self.clock(),
        )
        self._save(Collections.COMMENTS, str(comment.id), comment)
        return comment

    def list_comments(
        self, project_id: UUID, *, asset_id: UUID | None = None
    ) -> list[Comment]:
        self.projects.get_or_raise(project_id)
        comments = [
            comment
            for comment in self._load_all(Collections.COMMENTS, Comment)
            if comment.project_id == project_id
            and (asset_id is None or comment.asset_id == asset_id)
        ]
        comments.sort(key=lambda c: (c.created_at, str(c.id)))
        return comments

    # --- Storage stats -------------------------------------------------------

    def storage_stats(self, project_id: UUID) -> StorageStats:
        self.projects.get_or_raise(project_id)
        assets: list[Asset] = [
            asset
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.project_id == project_id
        ]
        return StorageStats(
            project_id=project_id,
            quota=StorageQuota(
                used=sum(asset.storage.size_bytes for asset in assets),
                limit=self.storage_quota_bytes,
                unit="bytes",
            ),
            object_count=len(assets),
        )


__all__ = ["OrchestrationRepository"]
