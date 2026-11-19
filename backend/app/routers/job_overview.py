"""Authoritative single-job overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_job_overview_repository
from ..repositories.job_overview import JobOverviewRepository
from ..schemas.job_overview import JobOverview

router = APIRouter(tags=["jobs", "overview"])


@router.get("/jobs/{job_id}/overview", response_model=JobOverview)
def job_overview(
    job_id: UUID,
    overview: Annotated[
        JobOverviewRepository, Depends(get_job_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent events to include"),
    ] = 5,
) -> JobOverview:
    """Return a compact snapshot of one job, derived from authoritative stores.

    An unknown job returns the shared 404 ``job_not_found`` envelope; a malformed
    id or an out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(job_id, recent_limit=recent_limit)


__all__ = ["router"]
