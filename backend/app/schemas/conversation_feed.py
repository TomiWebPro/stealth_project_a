"""Authoritative conversation feed contracts.

``GET /conversations/feed`` is the feed companion to the per-project
``GET /conversations`` list and ``GET /conversations/stats`` snapshot: a newest-
first, workspace-wide view of conversations, each projected from the
authoritative ``CONVERSATIONS`` collection with a last-message preview derived
from the ``MESSAGES`` store. It is built fresh on every call (no second index), so
the feed can never drift from what actually exists.

Every item carries the conversation and project identity (id + joined project
display name), the title, the canonical message count and a preview of the most
recent message (role + truncated excerpt, or ``None`` for an empty conversation).
Ordering is by descending ``(updated_at, conversation_id)``, giving a byte-for-byte
identical wire shape across the in-memory and SQLite stores. An optional
``project_id`` narrows the same derivation to one project.

Mirrored in ``frontend/src/types/conversationFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, NonEmptyStr, Timestamp
from .conversation import MessageRole


class ConversationFeedItem(ContractModel):
    """One conversation projected from the authoritative conversation store."""

    conversation_id: UUID
    project_id: UUID
    project_name: str
    title: NonEmptyStr
    message_count: int = Field(ge=0)
    last_message_role: MessageRole | None = None
    last_message_excerpt: str | None = None
    created_at: Timestamp
    updated_at: Timestamp


class ConversationFeed(ContractModel):
    """A bounded, newest-first page of conversations with a whole-scope total.

    ``total`` counts every conversation in scope before the ``limit`` page is
    applied, so a consumer can show the feed size and the newest page in one
    call. ``items`` is empty when there are no conversations in scope.
    """

    items: list[ConversationFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "ConversationFeedItem",
    "ConversationFeed",
]
