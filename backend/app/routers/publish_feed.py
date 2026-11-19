"""Authoritative publish-feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_publish_feed_repository
from ..repositories.publish_feed import PublishFeedRepository
from ..schemas.publish_feed import PublishFeed

router = APIRouter(tags=["publish", "feed"])


@router.get("/publishes", response_model=PublishFeed)
def get_publish_feed(
    publish_feed: Annotated[PublishFeedRepository, Depends(get_publish_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> PublishFeed:
    """Return published deliverables newest-first from authoritative receipts.

    Each item is projected from a live asset's ``publish_receipt`` in the
    authoritative asset store, with its project display name joined from the
    project store. An unknown ``project_id`` raises the shared 404 envelope; a
    malformed id or an invalid ``limit`` uses the shared 422 envelope.
    """
    return publish_feed.feed(project_id=project_id, limit=limit)


__all__ = ["router"]
