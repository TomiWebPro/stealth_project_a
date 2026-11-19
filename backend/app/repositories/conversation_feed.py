"""Authoritative conversation feed repository.

The feed is derived fresh from the ``CONVERSATIONS`` and ``MESSAGES`` collections
— the same stores ``ConversationRepository`` writes and ``ConversationStatsRepository``
reads — so it can never drift from ``GET /conversations``, ``GET /conversations/stats``
or from what actually exists. There is no persisted feed or second index — removing
this router leaves no collection behind.

Project display names are joined from the authoritative ``PROJECTS`` store; a
conversation whose project is missing falls back to a stable display name rather
than being dropped. Each item's last-message preview is derived from the most
recent ``MESSAGES`` record for that conversation with a deterministic
``(created_at, message_id)`` tie-break. Ordering is by descending
``(updated_at, conversation_id)`` so the newest conversation comes first and ties
are broken deterministically across the in-memory and SQLite adapters. ``total``
counts the whole filtered feed before the ``limit`` page is applied. An unknown
``project_id`` raises ``NotFoundError`` for the shared 404 envelope; bounds are
validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/conversationFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.conversation import Conversation, Message
from ..schemas.conversation_feed import ConversationFeed, ConversationFeedItem
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"
_EXCERPT_CHARS = 160


def _excerpt(content: str) -> str:
    """Return a trimmed single-line preview of a message body."""
    cleaned = " ".join(content.split())
    return cleaned if len(cleaned) <= _EXCERPT_CHARS else cleaned[:_EXCERPT_CHARS] + "…"


class ConversationFeedRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def feed(self, *, project_id: UUID | None = None, limit: int = 50) -> ConversationFeed:
        """Build the newest-first conversation feed, optionally scoped to a project.

        ``total`` counts every conversation in scope before the ``limit`` page is
        applied. ``items`` holds at most ``limit`` entries in descending last-
        activity order with a stable conversation-id tie-break.
        """
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        # Most recent message per conversation, with a deterministic tie-break.
        last_messages: dict[UUID, Message] = {}
        for message in self._load_all(Collections.MESSAGES, Message):
            current = last_messages.get(message.conversation_id)
            if current is None or (message.created_at, str(message.id)) > (
                current.created_at,
                str(current.id),
            ):
                last_messages[message.conversation_id] = message

        items: list[ConversationFeedItem] = []
        for conversation in self._load_all(Collections.CONVERSATIONS, Conversation):
            if project_id is not None and conversation.project_id != project_id:
                continue
            last = last_messages.get(conversation.id)
            items.append(
                ConversationFeedItem(
                    conversation_id=conversation.id,
                    project_id=conversation.project_id,
                    project_name=project_names.get(
                        conversation.project_id, _UNKNOWN_PROJECT_NAME
                    ),
                    title=conversation.title,
                    message_count=conversation.message_count,
                    last_message_role=last.role if last is not None else None,
                    last_message_excerpt=_excerpt(last.content) if last is not None else None,
                    created_at=conversation.created_at,
                    updated_at=conversation.updated_at,
                )
            )

        items.sort(
            key=lambda item: (item.updated_at, str(item.conversation_id)),
            reverse=True,
        )

        return ConversationFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["ConversationFeedRepository", "_UNKNOWN_PROJECT_NAME", "_excerpt"]
