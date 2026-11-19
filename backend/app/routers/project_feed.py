"""Authoritative project feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_project_feed_repository
from ..repositories.project_feed import ProjectFeedRepository
from ..schemas.project_feed import ProjectFeed
from ..schemas.project_stats import ProjectLifecycle

router = APIRouter(tags=["projects", "feed"])


@router.get("/projects/feed", response_model=ProjectFeed)
def get_project_feed(
    project_feed: Annotated[ProjectFeedRepository, Depends(get_project_feed_repository)],
    org_id: Annotated[UUID | None, Query(description="Scope to one organization")] = None,
    lifecycle: Annotated[
        ProjectLifecycle | None, Query(description="Filter by project lifecycle")
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> ProjectFeed:
    """Return projects newest-first from the authoritative project store.

    Each item is projected from a ``PROJECTS`` record, with its organization
    display name joined from the authoritative organization store. An
    unknown-but-valid ``org_id`` yields a zero-filled feed; a malformed id,
    invalid ``lifecycle`` or invalid ``limit`` uses the shared 422 envelope.
    """
    return project_feed.feed(org_id=org_id, lifecycle=lifecycle, limit=limit)


__all__ = ["router"]
