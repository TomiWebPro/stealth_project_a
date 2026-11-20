"""Authoritative single job-event overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query

from ..deps import get_event_overview_repository
from ..repositories.event_overview import EventOverviewRepository
from ..schemas.event_overview import EventOverview

router = APIRouter(tags=["events", "overview"])


@router.get(
    "/jobs/{job_id}/events/{seq}/overview",
    response_model=EventOverview,
)
def event_overview(
    job_id: UUID,
    seq: Annotated[int, Path(ge=0, description="Event sequence within the job")],
    overview: Annotated[EventOverviewRepository, Depends(get_event_overview_repository)],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent sibling events to include"),
    ] = 5,
) -> EventOverview:
    """Return a compact snapshot of one event in one job's stream.

    An unknown job or a sequence absent from it returns the shared 404 envelope
    (``job_not_found`` / ``event_not_found``); a malformed id/sequence or an
    out-of-range ``recent_limit`` uses the shared 422 ``validation_error``
    envelope.
    """
    return overview.overview(job_id, seq, recent_limit=recent_limit)


__all__ = ["router"]
