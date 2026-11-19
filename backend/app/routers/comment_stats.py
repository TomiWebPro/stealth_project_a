"""Authoritative comment-statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_comment_stats_repository
from ..repositories.comment_stats import CommentStatsRepository
from ..schemas.comment_stats import CommentStats

router = APIRouter(tags=["comments", "statistics"])


@router.get("/comments/stats", response_model=CommentStats)
def get_comment_stats(
    comment_stats: Annotated[
        CommentStatsRepository, Depends(get_comment_stats_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> CommentStats:
    """Comment metrics derived from the authoritative comment store.

    Zero-filled reference-category breakdowns, per-project and per-author comment
    counts, distinct author/project totals and newest-comment recency. An unknown
    ``project_id`` raises the shared 404 envelope; a malformed ``project_id``
    uses the shared 422 validation envelope.
    """
    return comment_stats.stats(project_id=project_id)


__all__ = ["router"]
