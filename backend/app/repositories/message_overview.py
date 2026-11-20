"""Authoritative single conversation-message overview repository.

The snapshot is derived fresh from the authoritative conversation/message/project
stores on every call, like ``ConversationOverviewRepository`` and
``MessageStatsRepository``: there is no second index to drift and removing the
router leaves no collection behind. The role/status buckets reuse the same
canonical values and count types as ``/conversations/stats`` and the project-name
fallback reuses the rule from ``/conversations/feed``, so the overview cannot
disagree with them.

Only messages belonging to the requested conversation contribute to the counts,
the 1-based chronological ``position`` and the sibling page; a message id from
another conversation is never mistaken for one in this conversation. The sibling
page is newest-first with a deterministic ``(created_at, id)`` tie-break across
both storage adapters, while ``counts`` describe the whole conversation and are
never bounded by ``recent_limit``.

An unknown conversation raises ``NotFoundError`` for the shared 404
``conversation_not_found`` envelope; a message that is absent from that
conversation raises the shared 404 ``message_not_found`` envelope. The
``recent_limit`` bound is validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/messageOverview.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from uuid import UUID

from ..errors import NotFoundError
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.conversation import Message
from ..schemas.conversation_stats import RoleMessageCount, StatusMessageCount
from ..schemas.message_overview import MessageOverview, MessageOverviewCounts
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .conversation_feed import _UNKNOWN_PROJECT_NAME
from .conversation_stats import _ROLES, _STATUSES
from .conversations import ConversationRepository


class MessageOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        conversations: ConversationRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.conversations = conversations

    def overview(
        self, conversation_id: UUID, message_id: UUID, *, recent_limit: int = 5
    ) -> MessageOverview:
        """Build a fresh snapshot for one message, newest sibling first."""
        conversation = self.conversations.get_or_raise(conversation_id)

        project = self._load(Collections.PROJECTS, str(conversation.project_id), Project)
        project_name = project.name if project is not None else _UNKNOWN_PROJECT_NAME

        messages = [
            message
            for message in self._load_all(Collections.MESSAGES, Message)
            if message.conversation_id == conversation_id
        ]
        chronological = sorted(
            messages, key=lambda message: (message.created_at, str(message.id))
        )
        position = next(
            (index + 1 for index, message in enumerate(chronological) if message.id == message_id),
            None,
        )
        if position is None:
            raise NotFoundError("message", str(message_id), code="message_not_found")
        target = chronological[position - 1]

        role_counts: Counter[str] = Counter(message.role for message in messages)
        status_counts: Counter[str] = Counter(message.status for message in messages)
        counts = MessageOverviewCounts(
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

        newest_first = sorted(
            messages,
            key=lambda message: (message.created_at, str(message.id)),
            reverse=True,
        )
        return MessageOverview(
            message_id=target.id,
            conversation_id=conversation.id,
            conversation_title=conversation.title,
            project_id=conversation.project_id,
            project_name=project_name,
            role=target.role,
            content=target.content,
            status=target.status,
            position=position,
            attachments=target.attachments,
            operation_id=target.operation_id,
            created_at=target.created_at,
            counts=counts,
            recent_siblings=newest_first[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["MessageOverviewRepository"]
