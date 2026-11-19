"""Authoritative single-conversation overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_conversation_overview_repository
from ..repositories.conversation_overview import ConversationOverviewRepository
from ..schemas.conversation_overview import ConversationOverview

router = APIRouter(tags=["conversations", "overview"])


@router.get("/conversations/{conversation_id}/overview", response_model=ConversationOverview)
def conversation_overview(
    conversation_id: UUID,
    overview: Annotated[
        ConversationOverviewRepository, Depends(get_conversation_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent messages to include"),
    ] = 5,
) -> ConversationOverview:
    """Return a compact snapshot of one conversation, derived from authoritative stores.

    An unknown conversation returns the shared 404 ``conversation_not_found``
    envelope; a malformed id or an out-of-range ``recent_limit`` uses the shared
    422 ``validation_error`` envelope.
    """
    return overview.overview(conversation_id, recent_limit=recent_limit)


__all__ = ["router"]
