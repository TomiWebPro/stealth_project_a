"""Authoritative job execution statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_job_stats_repository
from ..repositories.job_stats import JobStatsRepository
from ..schemas.job_stats import JobStats

router = APIRouter(tags=["jobs", "statistics"])


@router.get("/jobs/stats", response_model=JobStats)
def get_job_stats(
    job_stats: Annotated[JobStatsRepository, Depends(get_job_stats_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> JobStats:
    """Job execution metrics derived from the authoritative job store.

    Zero-filled status counts, per-operation totals/outcomes, success rate,
    in-flight/completed counts and mean duration. An unknown project returns the
    shared 404 error envelope; a malformed ``project_id`` uses the shared 422
    envelope.
    """
    return job_stats.stats(project_id=project_id)


__all__ = ["router"]
