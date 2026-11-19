"""Authoritative production-pipeline statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_pipeline_stats_repository
from ..repositories.pipeline_stats import PipelineStatsRepository
from ..schemas.pipeline_stats import PipelineStats

router = APIRouter(tags=["pipelines", "statistics"])


@router.get("/pipelines/stats", response_model=PipelineStats)
def get_pipeline_stats(
    pipeline_stats: Annotated[
        PipelineStatsRepository, Depends(get_pipeline_stats_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> PipelineStats:
    """Pipeline execution metrics derived from the authoritative chain stores.

    Zero-filled per-kind breakdowns, per-project chain counts, total jobs and
    assets, and newest-chain recency. An unknown ``project_id`` raises the
    shared 404 envelope; a malformed ``project_id`` uses the shared 422
    validation envelope.
    """
    return pipeline_stats.stats(project_id=project_id)


__all__ = ["router"]
