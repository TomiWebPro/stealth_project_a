"""Authoritative single-conversation overview contracts.

The Chat screen needs a compact, single-conversation snapshot (identity, message
breakdowns, a last-message preview and the newest messages). Deriving it on the
backend — where conversations and messages are authoritative — keeps every client
reading the same numbers and avoids reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
The role/status buckets reuse ``RoleMessageCount``/``StatusMessageCount`` from
``/conversations/stats`` and the last-message preview reuses the excerpt rule
from ``/conversations/feed``, so the overview cannot disagree with those views.
Mirrors ``frontend/src/types/conversationOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, NonEmptyStr, Timestamp
from .conversation import Message, MessageRole
from .conversation_stats import RoleMessageCount, StatusMessageCount


class ConversationOverviewCounts(ContractModel):
    """Message totals for one conversation, derived from the authoritative store."""

    total: int = Field(ge=0)
    by_role: list[RoleMessageCount] = Field(default_factory=list)
    by_status: list[StatusMessageCount] = Field(default_factory=list)


class ConversationOverview(ContractModel):
    """A single-conversation snapshot: identity, counts and a few recent messages.

    ``counts`` is zero-filled over the canonical message role/status values and
    ``total`` counts every message in the conversation. ``last_message_role`` and
    ``last_message_excerpt`` describe the most recent message (``None`` for an
    empty conversation). ``recent_messages`` is newest-first and bounded by
    ``recent_limit``; the counts and preview are never bounded by that page.
    """

    conversation_id: UUID
    project_id: UUID
    project_name: str
    title: NonEmptyStr
    created_by: UUID
    created_at: Timestamp
    updated_at: Timestamp
    message_count: int = Field(ge=0)
    last_message_role: MessageRole | None = None
    last_message_excerpt: str | None = None
    counts: ConversationOverviewCounts
    recent_messages: list[Message] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["ConversationOverview", "ConversationOverviewCounts"]
