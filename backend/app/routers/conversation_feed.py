"""Authoritative conversation feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_conversation_feed_repository
from ..repositories.conversation_feed import ConversationFeedRepository
from ..schemas.conversation_feed import ConversationFeed

router = APIRouter(tags=["conversations", "feed"])


@router.get("/conversations/feed", response_model=ConversationFeed)
def get_conversation_feed(
    conversation_feed: Annotated[
        ConversationFeedRepository, Depends(get_conversation_feed_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> ConversationFeed:
    """Return conversations newest-first from the authoritative conversation store.

    Each item is projected from a ``CONVERSATIONS`` record, with its project display
    name joined from the authoritative project store and a last-message preview
    derived from the ``MESSAGES`` store. An unknown ``project_id`` raises the shared
    404 envelope; a malformed id or an invalid ``limit`` uses the shared 422 envelope.
    """
    return conversation_feed.feed(project_id=project_id, limit=limit)


__all__ = ["router"]
