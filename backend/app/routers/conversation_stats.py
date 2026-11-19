"""Authoritative conversation and message statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_conversation_stats_repository
from ..repositories.conversation_stats import ConversationStatsRepository
from ..schemas.conversation_stats import ConversationStats

router = APIRouter(tags=["conversations", "statistics"])


@router.get("/conversations/stats", response_model=ConversationStats)
def get_conversation_stats(
    conversation_stats: Annotated[
        ConversationStatsRepository, Depends(get_conversation_stats_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> ConversationStats:
    """Conversation metrics derived from the authoritative stores.

    Zero-filled role/status breakdowns, message volume, average messages per
    conversation and last activity. An unknown project returns the shared 404
    error envelope; a malformed ``project_id`` uses the shared 422 envelope.
    """
    return conversation_stats.stats(project_id=project_id)


__all__ = ["router"]
