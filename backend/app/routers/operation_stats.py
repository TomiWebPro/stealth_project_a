"""Authoritative operation catalog statistics endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..deps import get_operation_stats_repository
from ..repositories.operation_stats import OperationStatsRepository
from ..schemas.operation_stats import OperationStats

router = APIRouter(tags=["operations", "statistics"])


@router.get("/operations/stats", response_model=OperationStats)
def get_operation_stats(
    operation_stats: Annotated[
        OperationStatsRepository, Depends(get_operation_stats_repository)
    ],
) -> OperationStats:
    """Catalog metrics derived from the authoritative operation catalog."""
    return operation_stats.stats()


__all__ = ["router"]
