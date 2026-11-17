"""Splat/COLMAP pipeline and camera-path bridge endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from ..deps import get_current_user_id, get_splat_service
from ..splat import SplatChain, SplatChainRequest, SplatPipelineService

router = APIRouter(tags=["splat"])


@router.post(
    "/pipelines/splat",
    response_model=SplatChain,
    status_code=status.HTTP_201_CREATED,
)
def create_splat_chain(
    payload: SplatChainRequest,
    splat: Annotated[SplatPipelineService, Depends(get_splat_service)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> SplatChain:
    return splat.create_chain(payload, user_id=user_id)


@router.get("/pipelines/splat", response_model=list[SplatChain])
def list_splat_chains(
    splat: Annotated[SplatPipelineService, Depends(get_splat_service)],
    project_id: Annotated[UUID | None, Query(description="Filter by project")] = None,
) -> list[SplatChain]:
    return splat.list(project_id)


@router.get("/pipelines/splat/{chain_id}", response_model=SplatChain)
def get_splat_chain(
    chain_id: UUID,
    splat: Annotated[SplatPipelineService, Depends(get_splat_service)],
) -> SplatChain:
    return splat.get(chain_id)


__all__ = ["router"]
