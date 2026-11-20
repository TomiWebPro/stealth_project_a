"""Authoritative single conversation-message overview contracts.

The Chat UI needs a compact snapshot of one message with its conversation and
project context: the message identity/content, its 1-based chronological position
in the conversation, conversation-wide message counts (zero-filled over the
canonical role/status values) and a bounded newest-first page of sibling
messages. Deriving it on the backend — where conversations and messages are
authoritative — keeps every client reading the same numbers and avoids
reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
The role/status buckets reuse ``RoleMessageCount``/``StatusMessageCount`` from
``/conversations/stats`` and the project-name fallback reuses the rule from
``/conversations/feed``, so the overview cannot disagree with those views.
``counts`` describe the whole conversation and are never bounded by
``recent_limit``; the sibling page is bounded and newest-first with a
deterministic id tie-break.

Mirrors ``frontend/src/types/messageOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, NonEmptyStr, Timestamp
from .conversation import AttachmentRef, Message, MessageRole, MessageStatus
from .conversation_stats import RoleMessageCount, StatusMessageCount


class MessageOverviewCounts(ContractModel):
    """Whole-conversation message totals, derived from the authoritative store."""

    total: int = Field(ge=0)
    by_role: list[RoleMessageCount] = Field(default_factory=list)
    by_status: list[StatusMessageCount] = Field(default_factory=list)


class MessageOverview(ContractModel):
    """A single-message snapshot: identity, context, counts and recent siblings.

    ``position`` is the 1-based chronological index of the message within its
    conversation. ``counts`` is zero-filled over the canonical message role/status
    values and ``total`` counts every message in the conversation.
    ``recent_siblings`` is newest-first and bounded by ``recent_limit``; the
    counts are never bounded by that page.
    """

    message_id: UUID
    conversation_id: UUID
    conversation_title: NonEmptyStr
    project_id: UUID
    project_name: str
    role: MessageRole
    content: str
    status: MessageStatus
    position: int = Field(ge=1)
    attachments: list[AttachmentRef] = Field(default_factory=list)
    operation_id: str | None = None
    created_at: Timestamp
    counts: MessageOverviewCounts
    recent_siblings: list[Message] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["MessageOverview", "MessageOverviewCounts"]
