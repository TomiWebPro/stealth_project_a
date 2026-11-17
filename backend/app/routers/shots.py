"""Shot generation endpoints with LoRA auto-mounting."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from ..deps import get_current_user_id, get_shot_service
from ..shots import ShotChain, ShotChainRequest, ShotPipelineService

router = APIRouter(tags=["shots"])


@router.post(
    "/pipelines/shot",
    response_model=ShotChain,
    status_code=status.HTTP_201_CREATED,
)
def create_shot_chain(
    payload: ShotChainRequest,
    shots: Annotated[ShotPipelineService, Depends(get_shot_service)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> ShotChain:
    return shots.create_chain(payload, user_id=user_id)


@router.get("/pipelines/shot", response_model=list[ShotChain])
def list_shot_chains(
    shots: Annotated[ShotPipelineService, Depends(get_shot_service)],
    project_id: Annotated[UUID | None, Query(description="Filter by project")] = None,
) -> list[ShotChain]:
    return shots.list(project_id)


@router.get("/pipelines/shot/{chain_id}", response_model=ShotChain)
def get_shot_chain(
    chain_id: UUID,
    shots: Annotated[ShotPipelineService, Depends(get_shot_service)],
) -> ShotChain:
    return shots.get(chain_id)


__all__ = ["router"]
