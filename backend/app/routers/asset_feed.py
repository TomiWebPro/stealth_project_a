"""Authoritative asset feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_asset_feed_repository
from ..repositories.asset_feed import AssetFeedRepository
from ..schemas.asset_feed import AssetFeed

router = APIRouter(tags=["assets", "feed"])


@router.get("/assets/feed", response_model=AssetFeed)
def get_asset_feed(
    asset_feed: Annotated[AssetFeedRepository, Depends(get_asset_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> AssetFeed:
    """Return live assets newest-first from the authoritative asset store.

    Each item is projected from an ``ASSETS`` record, with its project display
    name joined from the authoritative project store; soft-deleted assets are
    excluded. An unknown ``project_id`` raises the shared 404 envelope; a
    malformed id or an invalid ``limit`` uses the shared 422 envelope.
    """
    return asset_feed.feed(project_id=project_id, limit=limit)


__all__ = ["router"]
