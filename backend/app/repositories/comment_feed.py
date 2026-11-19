"""Authoritative comment feed repository.

The feed is derived fresh from the ``COMMENTS`` collection — the same store the
comments router writes and collaboration statistics aggregates — so it can never
drift from ``GET /comments``. There is no persisted feed or second index —
removing this router leaves no collection behind.

Project display names are joined from the authoritative ``PROJECTS`` store; a
comment whose project is missing falls back to a stable display name rather than
being dropped. Ordering is by descending ``(created_at, comment_id)`` so the
newest comment comes first and ties are broken deterministically across the
in-memory and SQLite adapters. ``total`` counts the whole filtered feed before
the ``limit`` page is applied. An optional ``project_id`` scope validates the
project first so an unknown id uses the shared 404 envelope; bounds are validated
at the router (shared 422 envelope).

Mirrors ``frontend/src/types/commentFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Project
from ..schemas.comment_feed import CommentFeed, CommentFeedItem
from ..schemas.common import utcnow
from ..schemas.orchestration import Comment
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"


class CommentFeedRepository(BaseRepository):
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
        limit: int = 50,
    ) -> CommentFeed:
        """Build the newest-first comment feed, optionally scoped to a project.

        An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
        envelope is used (same behaviour as the other project-scoped routers).
        ``total`` counts every comment in scope before the ``limit`` page is
        applied.
        """
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        comments = [
            comment
            for comment in self._load_all(Collections.COMMENTS, Comment)
            if project_id is None or comment.project_id == project_id
        ]
        comments.sort(key=lambda comment: (comment.created_at, str(comment.id)), reverse=True)

        items = [
            CommentFeedItem(
                comment_id=comment.id,
                project_id=comment.project_id,
                project_name=project_names.get(comment.project_id, _UNKNOWN_PROJECT_NAME),
                asset_id=comment.asset_id,
                author_id=comment.author_id,
                body=comment.body,
                created_at=comment.created_at,
            )
            for comment in comments
        ]

        return CommentFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["CommentFeedRepository", "_UNKNOWN_PROJECT_NAME"]
