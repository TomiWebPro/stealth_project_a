"""Authoritative per-job execution log endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_job_logs_repository
from ..repositories.job_logs import JobLogsRepository
from ..schemas.job_logs import JobLogFrame, LogLevel

router = APIRouter(tags=["jobs", "logs"])


@router.get("/jobs/{job_id}/logs", response_model=JobLogFrame)
def get_job_logs(
    job_id: UUID,
    job_logs: Annotated[JobLogsRepository, Depends(get_job_logs_repository)],
    level: Annotated[
        LogLevel | None,
        Query(description="Only return entries at this console severity"),
    ] = None,
    since_seq: Annotated[
        int,
        Query(ge=0, description="Resume after this event sequence number"),
    ] = 0,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum entries to return"),
    ] = 50,
) -> JobLogFrame:
    """Return a chronological, filterable, paginated view of a job's log.

    Entries are derived from the authoritative job event stream. An unknown
    ``job_id`` raises the shared 404 envelope; an invalid ``level``, negative
    ``since_seq`` or out-of-range ``limit`` uses the shared 422 envelope.
    """
    return job_logs.logs(job_id, level=level, since_seq=since_seq, limit=limit)


__all__ = ["router"]
