"""Authoritative job feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_job_feed_repository
from ..repositories.job_feed import JobFeedRepository
from ..schemas.job_feed import JobFeed
from ..schemas.operation import JobStatus

router = APIRouter(tags=["jobs", "feed"])


@router.get("/jobs/feed", response_model=JobFeed)
def get_job_feed(
    job_feed: Annotated[JobFeedRepository, Depends(get_job_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    job_status: Annotated[
        JobStatus | None, Query(alias="status", description="Filter by job status")
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> JobFeed:
    """Return jobs newest-first from the authoritative job store.

    Each item is projected from a ``JOBS`` record, with its project display name
    joined from the authoritative project store. An unknown ``project_id`` raises
    the shared 404 envelope; a malformed id, invalid ``status`` or invalid
    ``limit`` uses the shared 422 envelope.
    """
    return job_feed.feed(project_id=project_id, status=job_status, limit=limit)


__all__ = ["router"]
