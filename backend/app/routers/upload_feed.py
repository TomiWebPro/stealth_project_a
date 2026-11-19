"""Authoritative upload-ticket feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_upload_feed_repository
from ..repositories.upload_feed import UploadFeedRepository
from ..schemas.upload_feed import UploadFeed

router = APIRouter(tags=["uploads", "feed"])


@router.get("/uploads/feed", response_model=UploadFeed)
def get_upload_feed(
    upload_feed: Annotated[UploadFeedRepository, Depends(get_upload_feed_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> UploadFeed:
    """Return upload tickets newest-first from the authoritative upload store.

    Each item is projected from an ``UPLOADS`` record, with its project display
    name joined from the authoritative project store. An unknown ``project_id``
    raises the shared 404 envelope; a malformed id or an invalid ``limit`` uses the
    shared 422 envelope.
    """
    return upload_feed.feed(project_id=project_id, limit=limit)


__all__ = ["router"]
