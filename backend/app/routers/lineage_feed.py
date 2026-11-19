"""Authoritative asset lineage-feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_lineage_feed_repository
from ..repositories.lineage_feed import LineageFeedRepository
from ..schemas.lineage_feed import LineageFeed

router = APIRouter(tags=["assets", "feed"])


@router.get("/lineage/feed", response_model=LineageFeed)
def get_lineage_feed(
    lineage_feed: Annotated[LineageFeedRepository, Depends(get_lineage_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> LineageFeed:
    """Return typed asset relationships newest-first from the authoritative store.

    Each item is projected from an ``ASSET_RELATIONSHIPS`` record with both
    endpoint asset names and a project display name joined from the authoritative
    stores. Links from soft-deleted/unknown source assets are excluded. An unknown
    ``project_id`` uses the shared 404 envelope; a malformed id or invalid
    ``limit`` uses the shared 422 envelope.
    """
    return lineage_feed.feed(project_id=project_id, limit=limit)


__all__ = ["router"]
