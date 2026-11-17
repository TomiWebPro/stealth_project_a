"""Orchestration, presence, comments and storage-stat endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from ..deps import get_current_user_id, get_orchestration_repository
from ..repositories.orchestration import OrchestrationRepository
from ..schemas.orchestration import (
    Comment,
    OrchestrationPlan,
    OrchestrationRun,
    OrchestrationRunRequest,
    Presence,
    StorageStats,
)

router = APIRouter(tags=["orchestration", "collaboration", "storage"])


class CommentCreate(BaseModel):
    """Router-local input for posting a comment (no shared wire contract)."""

    project_id: UUID
    body: str = Field(min_length=1)
    asset_id: UUID | None = None


# --- Plans -------------------------------------------------------------------


@router.post(
    "/orchestration/plans",
    response_model=OrchestrationPlan,
    status_code=status.HTTP_201_CREATED,
)
def create_plan(
    payload: OrchestrationRunRequest,
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
) -> OrchestrationPlan:
    return orchestration.create_plan(payload)


@router.get("/orchestration/plans", response_model=list[OrchestrationPlan])
def list_plans(
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Optional project filter")] = None,
) -> list[OrchestrationPlan]:
    return orchestration.list_plans(project_id)


@router.get("/orchestration/plans/{plan_id}", response_model=OrchestrationPlan)
def get_plan(
    plan_id: UUID,
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
) -> OrchestrationPlan:
    return orchestration.get_plan_or_raise(plan_id)


# --- Runs --------------------------------------------------------------------


@router.post(
    "/orchestration/runs",
    response_model=OrchestrationRun,
    status_code=status.HTTP_201_CREATED,
)
def create_run(
    payload: OrchestrationRunRequest,
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> OrchestrationRun:
    return orchestration.create_run(payload, user_id=user_id)


@router.get("/orchestration/runs/{run_id}", response_model=OrchestrationRun)
def get_run(
    run_id: UUID,
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
) -> OrchestrationRun:
    return orchestration.get_run_or_raise(run_id)


# --- Presence ----------------------------------------------------------------


@router.get("/presence", response_model=list[Presence])
def list_presence(
    project_id: Annotated[UUID, Query(description="Project to list presence for")],
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
) -> list[Presence]:
    return orchestration.list_presence(project_id)


@router.post("/presence", response_model=Presence, status_code=status.HTTP_201_CREATED)
def upsert_presence(
    payload: Presence,
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
) -> Presence:
    return orchestration.upsert_presence(
        payload.project_id,
        payload.user_id,
        payload.state,
        last_seen_at=payload.last_seen_at,
    )


# --- Comments ----------------------------------------------------------------


@router.get("/comments", response_model=list[Comment])
def list_comments(
    project_id: Annotated[UUID, Query(description="Project whose comments to list")],
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
    asset_id: Annotated[UUID | None, Query(description="Optional asset filter")] = None,
) -> list[Comment]:
    return orchestration.list_comments(project_id, asset_id=asset_id)


@router.post("/comments", response_model=Comment, status_code=status.HTTP_201_CREATED)
def add_comment(
    payload: CommentCreate,
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> Comment:
    return orchestration.add_comment(
        payload.project_id,
        payload.body,
        author_id=user_id,
        asset_id=payload.asset_id,
    )


# --- Storage -----------------------------------------------------------------


@router.get("/storage/stats", response_model=StorageStats)
def storage_stats(
    project_id: Annotated[UUID, Query(description="Project to summarise")],
    orchestration: Annotated[
        OrchestrationRepository, Depends(get_orchestration_repository)
    ],
) -> StorageStats:
    return orchestration.storage_stats(project_id)


__all__ = ["router"]
