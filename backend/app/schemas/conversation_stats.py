"""Authoritative conversation and message statistics contracts.

The Chat screen and workspace overview need aggregate conversation metrics
(message volume, role/status breakdowns, activity recency). Deriving them on the
backend — where conversations and messages are authoritative — keeps every
client reading the same numbers and avoids reproducing aggregation rules per
client.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
An optional ``project_id`` scope narrows the same derivation to one project.

Mirrored in ``frontend/src/types/conversationStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, Timestamp
from .conversation import MessageRole, MessageStatus


class RoleMessageCount(ContractModel):
    """Number of messages written in one role."""

    role: MessageRole
    count: int = Field(ge=0)


class StatusMessageCount(ContractModel):
    """Number of messages in one delivery status."""

    status: MessageStatus
    count: int = Field(ge=0)


class ConversationStats(ContractModel):
    """Metrics derived from the authoritative conversation/message stores.

    ``by_role`` and ``by_status`` are zero-filled over every canonical message
    role/status so a UI can read a bucket without guarding for a missing key.
    ``average_messages_per_conversation`` is the mean message count over all
    conversations (rounded to 3 decimals), or ``0.0`` when there are none.
    ``last_activity_at`` is the newest conversation ``updated_at`` (``None`` when
    there are no conversations).
    """

    total_conversations: int = Field(ge=0)
    total_messages: int = Field(ge=0)
    by_role: list[RoleMessageCount] = Field(default_factory=list)
    by_status: list[StatusMessageCount] = Field(default_factory=list)
    average_messages_per_conversation: float = Field(ge=0.0, default=0.0)
    last_activity_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = ["ConversationStats", "RoleMessageCount", "StatusMessageCount"]
