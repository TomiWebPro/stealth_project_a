"""Authoritative job retry statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_retry_stats_repository
from ..repositories.retry_stats import RetryStatsRepository
from ..schemas.retry_stats import RetryStats

router = APIRouter(tags=["jobs", "statistics"])


@router.get("/retries/stats", response_model=RetryStats)
def get_retry_stats(
    retry_stats: Annotated[RetryStatsRepository, Depends(get_retry_stats_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> RetryStats:
    """Job retry metrics derived from the authoritative retry ledger.

    Zero-filled retried-jobs-by-status breakdown, per-project retry activity,
    accepted-retry/job totals and newest-activity recency. An unknown
    ``project_id`` raises the shared 404 envelope; a malformed ``project_id``
    uses the shared 422 validation envelope.
    """
    return retry_stats.stats(project_id=project_id)


__all__ = ["router"]
