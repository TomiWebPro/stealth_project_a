"""Authoritative collaboration-feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_collaboration_feed_repository
from ..repositories.collaboration_feed import CollaborationFeedRepository
from ..schemas.collaboration_feed import CollaborationFeed, CollaborationSignal

router = APIRouter(tags=["collaboration", "feed"])


@router.get("/collaboration/feed", response_model=CollaborationFeed)
def get_collaboration_feed(
    collaboration_feed: Annotated[
        CollaborationFeedRepository, Depends(get_collaboration_feed_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    signal: Annotated[
        CollaborationSignal | None,
        Query(description="Filter to one collaboration signal kind"),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> CollaborationFeed:
    """Return collaboration signals newest-first from the authoritative stores.

    Each item is a presence signal (state + last-seen) or a comment signal
    (body/asset + created-at), with its project display name joined from the
    authoritative project store. An unknown ``project_id`` uses the shared 404
    envelope; a malformed id, invalid ``signal`` or invalid ``limit`` uses the
    shared 422 envelope.
    """
    return collaboration_feed.feed(project_id=project_id, signal=signal, limit=limit)


__all__ = ["router"]
