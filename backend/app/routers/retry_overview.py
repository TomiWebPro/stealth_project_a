"""Authoritative single-retry overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_retry_overview_repository
from ..repositories.retry_overview import RetryOverviewRepository
from ..schemas.retry_overview import RetryOverview

router = APIRouter(tags=["jobs", "overview"])


@router.get(
    "/retries/{job_id}/overview",
    response_model=RetryOverview,
)
def retry_overview(
    job_id: UUID,
    overview: Annotated[RetryOverviewRepository, Depends(get_retry_overview_repository)],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent sibling retries to include"),
    ] = 5,
) -> RetryOverview:
    """Return a compact snapshot of one retried job.

    An unknown job returns the shared 404 ``job_not_found`` envelope; a job with
    no accepted retries returns the shared 404 ``retry_not_found`` envelope. A
    malformed id or an out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(job_id, recent_limit=recent_limit)


__all__ = ["router"]
