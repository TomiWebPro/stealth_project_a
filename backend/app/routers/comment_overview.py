"""Authoritative single-comment overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_comment_overview_repository
from ..repositories.comment_overview import CommentOverviewRepository
from ..schemas.comment_overview import CommentOverview

router = APIRouter(tags=["comments", "collaboration", "overview"])


@router.get("/comments/{comment_id}/overview", response_model=CommentOverview)
def comment_overview(
    comment_id: UUID,
    overview: Annotated[
        CommentOverviewRepository, Depends(get_comment_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many same-thread comments to include"),
    ] = 5,
) -> CommentOverview:
    """Return a compact snapshot of one collaboration comment.

    An unknown comment returns the shared 404 ``comment_not_found`` envelope; a
    malformed id or out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(comment_id, recent_limit=recent_limit)


__all__ = ["router"]
