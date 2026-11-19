"""Authoritative collaboration statistics repository.

Statistics are derived from the authoritative ``PRESENCE`` and ``COMMENTS``
stores on every call (like ``LineageStatsRepository`` and ``AssetStatsRepository``):
there is no second index to drift and removing the router leaves no collection
behind.

Both collections carry ``project_id`` directly, so an optional project scope is a
simple filter with no join. ``by_state`` is zero-filled over the canonical
presence states so the wire shape is identical across the in-memory and SQLite
stores; ``by_project`` is sorted by descending comment count, then presence count,
then project id for deterministic cross-backend ordering. An unknown
``project_id`` raises ``NotFoundError`` so the shared 404 envelope is used,
matching the other project-scoped routers.

Mirrors ``frontend/src/types/collaborationStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from ..schemas.collaboration_stats import (
    CollaborationProjectCount,
    CollaborationStats,
    PresenceStateCount,
)
from ..schemas.common import utcnow
from ..schemas.orchestration import Comment, Presence, PresenceState
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_STATES = tuple(get_args(PresenceState))


class CollaborationStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> CollaborationStats:
        """Build fresh collaboration metrics, optionally scoped to a project."""
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        presences = [
            presence
            for presence in self._load_all(Collections.PRESENCE, Presence)
            if project_id is None or presence.project_id == project_id
        ]
        comments = [
            comment
            for comment in self._load_all(Collections.COMMENTS, Comment)
            if project_id is None or comment.project_id == project_id
        ]

        state_counts: Counter[str] = Counter(presence.state for presence in presences)
        by_state = [
            PresenceStateCount(state=state, count=state_counts.get(state, 0))
            for state in _STATES
        ]

        presence_by_project: Counter[UUID] = Counter(
            presence.project_id for presence in presences
        )
        comments_by_project: Counter[UUID] = Counter(
            comment.project_id for comment in comments
        )
        project_ids = set(presence_by_project) | set(comments_by_project)
        # Most-discussed projects first, with stable presence-count and project-id
        # tie-breaks so memory and SQLite produce byte-identical ordering.
        by_project = [
            CollaborationProjectCount(
                project_id=current_id,
                comments=comments_by_project.get(current_id, 0),
                presence=presence_by_project.get(current_id, 0),
            )
            for current_id in sorted(
                project_ids,
                key=lambda item: (
                    -comments_by_project.get(item, 0),
                    -presence_by_project.get(item, 0),
                    str(item),
                ),
            )
        ]

        participants = {presence.user_id for presence in presences} | {
            comment.author_id for comment in comments
        }

        # Recency ties are broken by the unique record key so the newest record is
        # identical on every backend: presence is keyed by project+user, comments
        # by their UUID.
        newest_presence = max(
            presences,
            key=lambda presence: (
                presence.last_seen_at,
                str(presence.user_id),
                str(presence.project_id),
            ),
            default=None,
        )
        newest_comment = max(
            comments,
            key=lambda comment: (comment.created_at, str(comment.id)),
            default=None,
        )

        return CollaborationStats(
            total_presence=len(presences),
            total_comments=len(comments),
            total_participants=len(participants),
            by_state=by_state,
            by_project=by_project,
            newest_presence_at=(
                newest_presence.last_seen_at if newest_presence is not None else None
            ),
            newest_comment_at=(
                newest_comment.created_at if newest_comment is not None else None
            ),
            generated_at=self.clock(),
        )


__all__ = ["CollaborationStatsRepository"]
