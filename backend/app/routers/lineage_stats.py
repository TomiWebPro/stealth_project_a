"""Authoritative asset lineage statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_lineage_stats_repository
from ..repositories.lineage_stats import LineageStatsRepository
from ..schemas.lineage_stats import LineageStats

router = APIRouter(tags=["assets", "statistics"])


@router.get("/lineage/stats", response_model=LineageStats)
def get_lineage_stats(
    lineage_stats: Annotated[
        LineageStatsRepository, Depends(get_lineage_stats_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> LineageStats:
    """Lineage metrics derived from the authoritative relationship store.

    Zero-filled relationship-type breakdowns, per-project link counts, distinct
    live-asset count and newest-link recency. Links from soft-deleted/unknown
    assets are excluded. An unknown ``project_id`` raises the shared 404 envelope;
    a malformed ``project_id`` uses the shared 422 validation envelope.
    """
    return lineage_stats.stats(project_id=project_id)


__all__ = ["router"]
