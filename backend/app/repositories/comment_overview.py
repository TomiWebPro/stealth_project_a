"""Authoritative single-comment overview repository.

The snapshot is derived fresh from the authoritative ``COMMENTS`` store on every
call, like ``CommentFeedRepository``/``CommentStatsRepository``: there is no
second index to drift and removing the router leaves no collection behind.
``counts`` reuses ``/comments/stats`` per-project semantics (comment and distinct
author totals) so the single view cannot disagree with that snapshot, and
``recent_comments`` reuses the canonical ``CommentFeedItem`` projection from
``/comments/feed``. Project display names are joined from the authoritative
``PROJECTS`` store with a stable fallback.

An unknown comment raises ``NotFoundError`` for the shared 404 ``comment_not_found``
envelope. The ``recent_limit`` query bound is validated at the router (shared 422
envelope).

Mirrors ``frontend/src/types/commentOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..errors import NotFoundError
from ..schemas.comment_feed import CommentFeedItem
from ..schemas.common import utcnow
from ..schemas.comment_overview import CommentOverview, CommentOverviewCounts
from ..schemas.orchestration import Comment
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"
_ASSET_REFERENCE = "asset"
_PROJECT_REFERENCE = "project"


class CommentOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def overview(self, comment_id: UUID, *, recent_limit: int = 5) -> CommentOverview:
        """Build a fresh snapshot for one comment."""
        comments = self._load_all(Collections.COMMENTS, Comment)
        target = next((comment for comment in comments if comment.id == comment_id), None)
        if target is None:
            raise NotFoundError("comment", str(comment_id), code="comment_not_found")

        project = self.projects.get(target.project_id)
        project_name = project.name if project is not None else _UNKNOWN_PROJECT_NAME

        project_comments = [
            comment for comment in comments if comment.project_id == target.project_id
        ]
        authors = {comment.author_id for comment in project_comments}
        assets = {
            comment.asset_id
            for comment in project_comments
            if comment.asset_id is not None
        }

        # A thread is all comments on the same project with the same asset scope
        # (project-level comments form the asset_id=None thread).
        thread = [
            comment for comment in project_comments if comment.asset_id == target.asset_id
        ]

        counts = CommentOverviewCounts(
            project_comments=len(project_comments),
            project_authors=len(authors),
            project_assets=len(assets),
            thread_comments=len(thread),
        )

        # Newest-first with a deterministic id tie-break so the page agrees with
        # the ordering used by the comment-feed and activity views.
        recent = sorted(
            thread,
            key=lambda comment: (comment.created_at, str(comment.id)),
            reverse=True,
        )[:recent_limit]
        recent_items = [
            CommentFeedItem(
                comment_id=comment.id,
                project_id=comment.project_id,
                project_name=project_name,
                asset_id=comment.asset_id,
                author_id=comment.author_id,
                body=comment.body,
                created_at=comment.created_at,
            )
            for comment in recent
        ]

        return CommentOverview(
            comment_id=target.id,
            project_id=target.project_id,
            project_name=project_name,
            asset_id=target.asset_id,
            author_id=target.author_id,
            body=target.body,
            created_at=target.created_at,
            reference=_ASSET_REFERENCE if target.asset_id is not None else _PROJECT_REFERENCE,
            counts=counts,
            recent_comments=recent_items,
            generated_at=self.clock(),
        )


__all__ = ["CommentOverviewRepository", "_UNKNOWN_PROJECT_NAME"]
