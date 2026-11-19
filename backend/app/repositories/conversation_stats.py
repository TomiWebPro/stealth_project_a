"""Authoritative conversation/message statistics repository.

Statistics are derived from the authoritative document stores on every call,
like ``JobStatsRepository`` and ``DashboardRepository``: there is no second index
to drift and removing the router leaves no collection behind.

``by_role`` and ``by_status`` are zero-filled over the canonical message
role/status orders so the wire shape is stable across the in-memory and SQLite
stores. An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
envelope is used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/conversationStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from ..schemas.common import utcnow
from ..schemas.conversation import Conversation, Message, MessageRole, MessageStatus
from ..schemas.conversation_stats import (
    ConversationStats,
    RoleMessageCount,
    StatusMessageCount,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_ROLES = tuple(get_args(MessageRole))
_STATUSES = tuple(get_args(MessageStatus))


class ConversationStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> ConversationStats:
        """Build fresh conversation metrics, optionally scoped to a project."""
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        conversations = [
            conversation
            for conversation in self._load_all(Collections.CONVERSATIONS, Conversation)
            if project_id is None or conversation.project_id == project_id
        ]
        conversation_ids = {conversation.id for conversation in conversations}
        messages = [
            message
            for message in self._load_all(Collections.MESSAGES, Message)
            if message.conversation_id in conversation_ids
        ]

        role_counts: Counter[str] = Counter(message.role for message in messages)
        status_counts: Counter[str] = Counter(message.status for message in messages)
        by_role = [
            RoleMessageCount(role=role, count=role_counts.get(role, 0))
            for role in _ROLES
        ]
        by_status = [
            StatusMessageCount(status=status, count=status_counts.get(status, 0))
            for status in _STATUSES
        ]

        total_conversations = len(conversations)
        total_messages = len(messages)
        average = (
            round(total_messages / total_conversations, 3)
            if total_conversations
            else 0.0
        )
        last_activity = max(
            (conversation.updated_at for conversation in conversations),
            default=None,
        )

        return ConversationStats(
            total_conversations=total_conversations,
            total_messages=total_messages,
            by_role=by_role,
            by_status=by_status,
            average_messages_per_conversation=average,
            last_activity_at=last_activity,
            generated_at=self.clock(),
        )


__all__ = ["ConversationStatsRepository"]
