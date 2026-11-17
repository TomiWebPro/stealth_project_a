"""Training pipeline chain endpoints (dataset-prep -> YAML -> lora-train)."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from ..deps import get_current_user_id, get_training_service
from ..training import LoraChain, LoraChainRequest, TrainingChainService

router = APIRouter(tags=["pipelines"])


@router.post(
    "/pipelines/lora",
    response_model=LoraChain,
    status_code=status.HTTP_201_CREATED,
)
def create_lora_chain(
    payload: LoraChainRequest,
    training: Annotated[TrainingChainService, Depends(get_training_service)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> LoraChain:
    return training.create_chain(payload, user_id=user_id)


@router.get("/pipelines/lora", response_model=list[LoraChain])
def list_lora_chains(
    training: Annotated[TrainingChainService, Depends(get_training_service)],
    project_id: Annotated[UUID | None, Query(description="Filter by project")] = None,
) -> list[LoraChain]:
    return training.list(project_id)


@router.get("/pipelines/lora/{chain_id}", response_model=LoraChain)
def get_lora_chain(
    chain_id: UUID,
    training: Annotated[TrainingChainService, Depends(get_training_service)],
) -> LoraChain:
    return training.get(chain_id)


__all__ = ["router"]
