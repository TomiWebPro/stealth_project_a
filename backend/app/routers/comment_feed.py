"""Authoritative comment-feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_comment_feed_repository
from ..repositories.comment_feed import CommentFeedRepository
from ..schemas.comment_feed import CommentFeed

router = APIRouter(tags=["collaboration", "feed"])


@router.get("/comments/feed", response_model=CommentFeed)
def get_comment_feed(
    comment_feed: Annotated[CommentFeedRepository, Depends(get_comment_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> CommentFeed:
    """Return comments newest-first from the authoritative comment store.

    Each item is projected from a ``COMMENTS`` record, with its project display
    name joined from the authoritative project store. An unknown ``project_id``
    uses the shared 404 envelope; a malformed id or invalid ``limit`` uses the
    shared 422 envelope.
    """
    return comment_feed.feed(project_id=project_id, limit=limit)


__all__ = ["router"]
