"""Authoritative orchestration-feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_orchestration_feed_repository
from ..repositories.orchestration_feed import OrchestrationFeedRepository
from ..schemas.orchestration_feed import OrchestrationFeed, OrchestrationFeedKind

router = APIRouter(tags=["orchestration", "feed"])


@router.get("/orchestration/feed", response_model=OrchestrationFeed)
def get_orchestration_feed(
    orchestration_feed: Annotated[
        OrchestrationFeedRepository, Depends(get_orchestration_feed_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    kind: Annotated[
        OrchestrationFeedKind | None,
        Query(description="Filter to one orchestration record kind"),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> OrchestrationFeed:
    """Return plans and runs newest-first from the authoritative orchestration stores.

    Plans are projected directly; runs are joined to their plan for project
    attribution and orphan runs are excluded. An unknown ``project_id`` uses the
    shared 404 envelope; a malformed id, invalid ``kind`` or invalid ``limit``
    uses the shared 422 envelope. ``total`` counts the whole filtered feed before
    the ``limit`` page is applied.
    """
    return orchestration_feed.feed(project_id=project_id, kind=kind, limit=limit)


__all__ = ["router"]
