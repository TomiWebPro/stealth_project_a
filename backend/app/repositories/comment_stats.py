"""Authoritative comment-statistics repository.

Statistics are derived from the authoritative ``COMMENTS`` store on every call
(like ``CollaborationStatsRepository`` and ``AssetStatsRepository``): there is no
second index to drift and removing the router leaves no collection behind.

``COMMENTS`` carries ``project_id`` directly, so an optional project scope is a
simple filter with no join. ``by_reference`` is zero-filled over the canonical
reference categories so the wire shape is identical across the in-memory and
SQLite stores; ``by_project`` and ``by_author`` are sorted by descending comment
count then id for deterministic cross-backend ordering. An unknown
``project_id`` raises ``NotFoundError`` so the shared 404 envelope is used,
matching the other project-scoped routers.

Mirrors ``frontend/src/types/commentStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import get_args
from uuid import UUID

from ..schemas.comment_stats import (
    CommentAuthorCount,
    CommentProjectCount,
    CommentReference,
    CommentReferenceCount,
    CommentStats,
)
from ..schemas.common import utcnow
from ..schemas.orchestration import Comment
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_REFERENCES = tuple(get_args(CommentReference))
_ASSET_REFERENCE = "asset"
_PROJECT_REFERENCE = "project"


class CommentStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> CommentStats:
        """Build fresh comment metrics, optionally scoped to a project."""
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        comments = [
            comment
            for comment in self._load_all(Collections.COMMENTS, Comment)
            if project_id is None or comment.project_id == project_id
        ]

        reference_counts: Counter[str] = Counter()
        comments_by_project: Counter[UUID] = Counter()
        authors_by_project: dict[UUID, set[UUID]] = defaultdict(set)
        comments_by_author: Counter[UUID] = Counter()
        for comment in comments:
            reference_counts[
                _ASSET_REFERENCE if comment.asset_id is not None else _PROJECT_REFERENCE
            ] += 1
            comments_by_project[comment.project_id] += 1
            authors_by_project[comment.project_id].add(comment.author_id)
            comments_by_author[comment.author_id] += 1

        by_reference = [
            CommentReferenceCount(reference=reference, count=reference_counts.get(reference, 0))
            for reference in _REFERENCES
        ]

        by_project = [
            CommentProjectCount(
                project_id=current_id,
                comments=comments_by_project[current_id],
                authors=len(authors_by_project[current_id]),
            )
            for current_id in sorted(
                comments_by_project,
                key=lambda item: (-comments_by_project[item], str(item)),
            )
        ]

        by_author = [
            CommentAuthorCount(author_id=author_id, comments=count)
            for author_id, count in sorted(
                comments_by_author.items(),
                key=lambda item: (-item[1], str(item[0])),
            )
        ]

        # Recency ties are broken by the unique comment id so the newest comment
        # is identical on every backend.
        newest_comment = max(
            comments,
            key=lambda comment: (comment.created_at, str(comment.id)),
            default=None,
        )

        return CommentStats(
            total_comments=len(comments),
            total_authors=len(comments_by_author),
            total_projects=len(comments_by_project),
            by_reference=by_reference,
            by_project=by_project,
            by_author=by_author,
            newest_comment_at=(
                newest_comment.created_at if newest_comment is not None else None
            ),
            generated_at=self.clock(),
        )


__all__ = ["CommentStatsRepository"]
