"""Authoritative job dispatch-queue endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_job_queue_repository
from ..repositories.job_queue import JobQueueRepository
from ..schemas.job_queue import JobQueueView

router = APIRouter(tags=["jobs", "queue"])


@router.get("/jobs/queue", response_model=JobQueueView)
def get_job_queue(
    job_queue: Annotated[JobQueueRepository, Depends(get_job_queue_repository)],
    project_id: Annotated[
        UUID | None,
        Query(description="Only include active jobs belonging to this project"),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum queue entries to return"),
    ] = 50,
) -> JobQueueView:
    """Return the active (queued + running) job queue in FIFO order.

    Entries are derived from the authoritative job store. An unknown
    ``project_id`` raises the shared 404 envelope; a malformed id or an invalid
    ``limit`` uses the shared 422 envelope.
    """
    return job_queue.queue(project_id=project_id, limit=limit)


__all__ = ["router"]
