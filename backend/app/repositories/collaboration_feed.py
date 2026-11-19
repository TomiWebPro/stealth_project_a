"""Authoritative collaboration feed repository.

The feed is derived fresh from the authoritative ``PRESENCE`` and ``COMMENTS``
collections — the same stores the presence/comment routers write and
``CollaborationStatsRepository`` aggregates — so it can never drift from those
views. There is no persisted feed or second index: removing this router leaves no
collection behind.

Both stores carry ``project_id`` directly, so an optional project scope is a
simple filter with no join. A coarse ``signal`` kind merges the two record types
onto one wire shape (presence → online/away/offline state + ``last_seen_at``,
comment → body/asset + ``created_at``) with a unified ``occurred_at`` recency.
Project display names are joined from the authoritative ``PROJECTS`` store; a
signal whose project is missing falls back to a stable display name rather than
being dropped. Ordering is by descending
``(occurred_at, signal_id, signal, project_id)`` so the newest signal comes first
and ties break deterministically across the in-memory and SQLite adapters.
``total`` counts the whole filtered feed before the ``limit`` page is applied. An
unknown ``project_id`` raises ``NotFoundError`` so the shared 404 envelope is
used; bounds and signal kind are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/collaborationFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Project
from ..schemas.collaboration_feed import (
    CollaborationFeed,
    CollaborationFeedItem,
    CollaborationSignal,
)
from ..schemas.common import utcnow
from ..schemas.orchestration import Comment, Presence
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"


class CollaborationFeedRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def feed(
        self,
        *,
        project_id: UUID | None = None,
        signal: CollaborationSignal | None = None,
        limit: int = 50,
    ) -> CollaborationFeed:
        """Build the newest-first collaboration feed, optionally filtered.

        An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
        envelope is used (same behaviour as the other project-scoped routers).
        ``signal`` narrows to one kind of collaboration signal. ``total`` counts
        every signal in scope before the ``limit`` page is applied.
        """
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        items: list[CollaborationFeedItem] = []

        if signal is None or signal == "presence":
            for presence in self._load_all(Collections.PRESENCE, Presence):
                if project_id is not None and presence.project_id != project_id:
                    continue
                items.append(
                    CollaborationFeedItem(
                        signal_id=presence.user_id,
                        signal="presence",
                        project_id=presence.project_id,
                        project_name=project_names.get(
                            presence.project_id, _UNKNOWN_PROJECT_NAME
                        ),
                        actor_id=presence.user_id,
                        state=presence.state,
                        body=None,
                        asset_id=None,
                        occurred_at=presence.last_seen_at,
                    )
                )

        if signal is None or signal == "comment":
            for comment in self._load_all(Collections.COMMENTS, Comment):
                if project_id is not None and comment.project_id != project_id:
                    continue
                items.append(
                    CollaborationFeedItem(
                        signal_id=comment.id,
                        signal="comment",
                        project_id=comment.project_id,
                        project_name=project_names.get(
                            comment.project_id, _UNKNOWN_PROJECT_NAME
                        ),
                        actor_id=comment.author_id,
                        state=None,
                        body=comment.body,
                        asset_id=comment.asset_id,
                        occurred_at=comment.created_at,
                    )
                )

        items.sort(
            key=lambda item: (
                item.occurred_at,
                str(item.signal_id),
                item.signal,
                str(item.project_id),
            ),
            reverse=True,
        )

        return CollaborationFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["CollaborationFeedRepository", "_UNKNOWN_PROJECT_NAME"]
