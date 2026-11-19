"""Authoritative single-conversation overview repository.

The snapshot is derived fresh from the authoritative stores on every call, like
``ProjectOverviewRepository`` and ``AssetOverviewRepository``: there is no second
index to drift and removing the router leaves no collection behind. The role/
status buckets reuse the same canonical values and count types as
``/conversations/stats``, and the last-message preview reuses the ``_excerpt``
rule from ``/conversations/feed``, so the overview cannot disagree with them.

An unknown conversation raises ``NotFoundError`` for the shared 404
``conversation_not_found`` envelope; the ``recent_limit`` bound is validated at
the router (shared 422 envelope).

Mirrors ``frontend/src/types/conversationOverview.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from uuid import UUID

from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.conversation import Conversation, Message
from ..schemas.conversation_overview import ConversationOverview, ConversationOverviewCounts
from ..schemas.conversation_stats import RoleMessageCount, StatusMessageCount
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .conversation_feed import _UNKNOWN_PROJECT_NAME, _excerpt
from .conversation_stats import _ROLES, _STATUSES
from .conversations import ConversationRepository


class ConversationOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        conversations: ConversationRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.conversations = conversations

    def overview(self, conversation_id: UUID, *, recent_limit: int = 5) -> ConversationOverview:
        """Build a fresh snapshot for one conversation, newest message first."""
        conversation = self.conversations.get_or_raise(conversation_id)

        project = self._load(Collections.PROJECTS, str(conversation.project_id), Project)
        project_name = project.name if project is not None else _UNKNOWN_PROJECT_NAME

        messages = [
            message
            for message in self._load_all(Collections.MESSAGES, Message)
            if message.conversation_id == conversation_id
        ]
        messages.sort(
            key=lambda message: (message.created_at, str(message.id)),
            reverse=True,
        )

        role_counts: Counter[str] = Counter(message.role for message in messages)
        status_counts: Counter[str] = Counter(message.status for message in messages)
        counts = ConversationOverviewCounts(
            total=len(messages),
            by_role=[
                RoleMessageCount(role=role, count=role_counts.get(role, 0))
                for role in _ROLES
            ],
            by_status=[
                StatusMessageCount(status=status, count=status_counts.get(status, 0))
                for status in _STATUSES
            ],
        )

        last = messages[0] if messages else None

        return ConversationOverview(
            conversation_id=conversation.id,
            project_id=conversation.project_id,
            project_name=project_name,
            title=conversation.title,
            created_by=conversation.created_by,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
            message_count=conversation.message_count,
            last_message_role=last.role if last is not None else None,
            last_message_excerpt=_excerpt(last.content) if last is not None else None,
            counts=counts,
            recent_messages=messages[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["ConversationOverviewRepository"]
