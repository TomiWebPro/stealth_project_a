"""Authoritative job event feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_event_feed_repository
from ..repositories.event_feed import EventFeedRepository
from ..schemas.event_feed import EventFeed
from ..schemas.operation import JobEventType

router = APIRouter(tags=["events", "feed"])


@router.get("/events/feed", response_model=EventFeed)
def get_event_feed(
    event_feed: Annotated[EventFeedRepository, Depends(get_event_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    type: Annotated[JobEventType | None, Query(description="Filter to one event type")] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> EventFeed:
    """Return job events newest-first from the authoritative event stream.

    Each item is projected from a ``JOB_EVENTS`` record, with job operation and
    project identity joined from the authoritative stores. An unknown
    ``project_id`` uses the shared 404 envelope; a malformed id, invalid
    ``type`` or invalid ``limit`` uses the shared 422 envelope.
    """
    return event_feed.feed(project_id=project_id, type=type, limit=limit)


__all__ = ["router"]
