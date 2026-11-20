"""Authoritative single conversation-message overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_message_overview_repository
from ..repositories.message_overview import MessageOverviewRepository
from ..schemas.message_overview import MessageOverview

router = APIRouter(tags=["conversations", "overview"])


@router.get(
    "/conversations/{conversation_id}/messages/{message_id}/overview",
    response_model=MessageOverview,
)
def message_overview(
    conversation_id: UUID,
    message_id: UUID,
    overview: Annotated[MessageOverviewRepository, Depends(get_message_overview_repository)],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent sibling messages to include"),
    ] = 5,
) -> MessageOverview:
    """Return a compact snapshot of one message in one conversation.

    An unknown conversation or a message absent from it returns the shared 404
    envelope (``conversation_not_found`` / ``message_not_found``); a malformed id
    or out-of-range ``recent_limit`` uses the shared 422 ``validation_error``
    envelope.
    """
    return overview.overview(conversation_id, message_id, recent_limit=recent_limit)


__all__ = ["router"]
