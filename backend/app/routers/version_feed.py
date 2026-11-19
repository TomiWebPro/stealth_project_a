"""Authoritative asset version-feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_version_feed_repository
from ..repositories.version_feed import VersionFeedRepository
from ..schemas.version_feed import VersionFeed

router = APIRouter(tags=["assets", "feed"])


@router.get("/versions/feed", response_model=VersionFeed)
def get_version_feed(
    version_feed: Annotated[VersionFeedRepository, Depends(get_version_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> VersionFeed:
    """Return asset versions newest-first from the authoritative version store.

    Each item is projected from an ``ASSET_VERSIONS`` record with its asset
    identity and project display name joined from the authoritative stores.
    Versions of soft-deleted/unknown assets are excluded. An unknown
    ``project_id`` uses the shared 404 envelope; a malformed id or invalid
    ``limit`` uses the shared 422 envelope.
    """
    return version_feed.feed(project_id=project_id, limit=limit)


__all__ = ["router"]
