"""Authoritative activity statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_activity_stats_repository
from ..repositories.activity_stats import ActivityStatsRepository
from ..schemas.activity_stats import ActivityStats

router = APIRouter(tags=["activity", "statistics"])


@router.get("/activity/stats", response_model=ActivityStats)
def get_activity_stats(
    activity_stats: Annotated[
        ActivityStatsRepository, Depends(get_activity_stats_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> ActivityStats:
    """Activity metrics derived from the authoritative event stream.

    Zero-filled per-kind breakdowns, per-project event/participant counts, distinct
    participant total and newest-event recency. An unknown ``project_id`` raises the
    shared 404 envelope; a malformed ``project_id`` uses the shared 422 validation
    envelope.
    """
    return activity_stats.stats(project_id=project_id)


__all__ = ["router"]
