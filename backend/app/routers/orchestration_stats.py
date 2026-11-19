"""Authoritative orchestration statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_orchestration_stats_repository
from ..repositories.orchestration_stats import OrchestrationStatsRepository
from ..schemas.orchestration_stats import OrchestrationStats

router = APIRouter(tags=["orchestration", "statistics"])


@router.get("/orchestration/stats", response_model=OrchestrationStats)
def get_orchestration_stats(
    orchestration_stats: Annotated[
        OrchestrationStatsRepository, Depends(get_orchestration_stats_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> OrchestrationStats:
    """Orchestration metrics derived from the authoritative plan/run stores.

    Zero-filled lifecycle-stage breakdowns, per-project plan/run activity, plan
    step and linked-job totals, and newest-plan/run recency. An unknown
    ``project_id`` raises the shared 404 envelope; a malformed ``project_id`` uses
    the shared 422 validation envelope.
    """
    return orchestration_stats.stats(project_id=project_id)


__all__ = ["router"]
