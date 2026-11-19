"""Authoritative job retry feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_retry_feed_repository
from ..repositories.retry_feed import RetryFeedRepository
from ..schemas.retry_feed import RetryFeed

router = APIRouter(tags=["jobs", "feed"])


@router.get("/retries/feed", response_model=RetryFeed)
def get_retry_feed(
    retry_feed: Annotated[RetryFeedRepository, Depends(get_retry_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> RetryFeed:
    """Return retried jobs newest-first from the authoritative retry ledger.

    Each item is projected from a retried job with its current lifecycle state,
    accepted-retry count and joined project display name. Ledger entries whose
    job no longer exists are excluded. An unknown ``project_id`` uses the shared
    404 envelope; a malformed id or invalid ``limit`` uses the shared 422
    envelope.
    """
    return retry_feed.feed(project_id=project_id, limit=limit)


__all__ = ["router"]
