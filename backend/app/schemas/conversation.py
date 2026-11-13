"""Conversation contracts (messages, streaming deltas)."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Metadata, NonEmptyStr, Timestamp

MessageRole = Literal["system", "user", "assistant", "tool"]
MessageStatus = Literal["pending", "streaming", "complete", "error"]


class AttachmentRef(ContractModel):
    asset_id: UUID
    role: Literal["input", "reference"] = "input"


class Message(ContractModel):
    id: UUID
    conversation_id: UUID
    role: MessageRole
    content: str
    status: MessageStatus = "complete"
    attachments: list[AttachmentRef] = Field(default_factory=list)
    operation_id: str | None = None
    metadata: Metadata = Field(default_factory=dict)
    created_at: Timestamp


class Conversation(ContractModel):
    id: UUID
    project_id: UUID
    title: NonEmptyStr
    created_by: UUID
    created_at: Timestamp
    updated_at: Timestamp
    message_count: int = Field(ge=0, default=0)


class ConversationCreate(ContractModel):
    title: NonEmptyStr
    initial_message: str | None = None


class MessageCreate(ContractModel):
    role: MessageRole = "user"
    content: NonEmptyStr
    attachments: list[AttachmentRef] = Field(default_factory=list)
    operation_id: str | None = None


# --- Streaming events (WebSocket frames) ------------------------------------

StreamEventType = Literal[
    "message_start",
    "delta",
    "message_complete",
    "error",
]


class StreamEvent(ContractModel):
    """A single frame on the conversation event stream.

    `seq` is monotonically increasing per stream so clients can recover after
    a dropped connection by resuming from the last seen sequence number.
    """

    type: StreamEventType
    message_id: UUID
    seq: int = Field(ge=0)
    delta: str | None = None
    error: str | None = None


__all__ = [
    "AttachmentRef",
    "Conversation",
    "ConversationCreate",
    "Message",
    "MessageCreate",
    "MessageRole",
    "MessageStatus",
    "StreamEvent",
    "StreamEventType",
]
