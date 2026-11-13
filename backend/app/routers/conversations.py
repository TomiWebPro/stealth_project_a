"""Conversation and message endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from ..deps import (
    get_conversation_repository,
    get_current_user_id,
)
from ..repositories.conversations import ConversationRepository
from ..schemas.conversation import (
    Conversation,
    ConversationCreate,
    Message,
    MessageCreate,
)

router = APIRouter(tags=["conversations"])


@router.get("/conversations", response_model=list[Conversation])
def list_conversations(
    project_id: Annotated[UUID, Query(description="Project whose conversations to list")],
    conversations: Annotated[
        ConversationRepository, Depends(get_conversation_repository)
    ],
) -> list[Conversation]:
    return conversations.list(project_id=project_id)


@router.post(
    "/projects/{project_id}/conversations",
    response_model=Conversation,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    project_id: UUID,
    payload: ConversationCreate,
    conversations: Annotated[
        ConversationRepository, Depends(get_conversation_repository)
    ],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> Conversation:
    return conversations.create(project_id, payload, user_id=user_id)


@router.get("/conversations/{conversation_id}", response_model=Conversation)
def get_conversation(
    conversation_id: UUID,
    conversations: Annotated[
        ConversationRepository, Depends(get_conversation_repository)
    ],
) -> Conversation:
    return conversations.get_or_raise(conversation_id)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[Message],
)
def list_messages(
    conversation_id: UUID,
    conversations: Annotated[
        ConversationRepository, Depends(get_conversation_repository)
    ],
    limit: Annotated[int | None, Query(ge=1, le=1000)] = None,
) -> list[Message]:
    """Messages in chronological order (oldest first)."""
    return conversations.list_messages(conversation_id, limit=limit)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=Message,
    status_code=status.HTTP_201_CREATED,
)
def create_message(
    conversation_id: UUID,
    payload: MessageCreate,
    conversations: Annotated[
        ConversationRepository, Depends(get_conversation_repository)
    ],
) -> Message:
    return conversations.add_message(conversation_id, payload)


__all__ = ["router"]
