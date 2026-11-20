"""Authoritative single activity event overview endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_activity_overview_repository
from ..repositories.activity_overview import ActivityOverviewRepository
from ..schemas.activity_overview import ActivityOverview

router = APIRouter(tags=["activity", "overview"])


@router.get(
    "/activity/{event_id}/overview",
    response_model=ActivityOverview,
)
def activity_overview(
    event_id: str,
    overview: Annotated[ActivityOverviewRepository, Depends(get_activity_overview_repository)],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent sibling events to include"),
    ] = 5,
) -> ActivityOverview:
    """Return a compact snapshot of one workspace activity event.

    A malformed ``event_id`` uses the shared 422 ``validation_error`` envelope; a
    well-formed id with no matching live event uses the shared 404
    ``activity_not_found`` envelope. An out-of-range ``recent_limit`` uses the
    shared 422 envelope.
    """
    return overview.overview(event_id, recent_limit=recent_limit)


__all__ = ["router"]
