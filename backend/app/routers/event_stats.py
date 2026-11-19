"""Authoritative job event stream statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_event_stats_repository
from ..repositories.event_stats import EventStatsRepository
from ..schemas.event_stats import EventStats

router = APIRouter(tags=["events", "statistics"])


@router.get("/events/stats", response_model=EventStats)
def get_event_stats(
    event_stats: Annotated[EventStatsRepository, Depends(get_event_stats_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> EventStats:
    """Job event stream metrics derived from the authoritative event store.

    Zero-filled per-type breakdown (status/progress/intermediate/result/error/
    log), per-job event activity with recency, newest-event recency and
    generation time. An unknown ``project_id`` raises the shared 404 envelope;
    a malformed ``project_id`` uses the shared 422 validation envelope.
    """
    return event_stats.stats(project_id=project_id)


__all__ = ["router"]
