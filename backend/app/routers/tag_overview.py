"""Authoritative single-tag overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_tag_overview_repository
from ..repositories.tag_overview import TagOverviewRepository
from ..schemas.tag_overview import TagOverview

router = APIRouter(tags=["tags", "overview"])


@router.get(
    "/tags/{tag}/overview",
    response_model=TagOverview,
)
def tag_overview(
    tag: str,
    overview: Annotated[TagOverviewRepository, Depends(get_tag_overview_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent tagged assets to include"),
    ] = 5,
) -> TagOverview:
    """Return a compact snapshot of one asset tag.

    A tag no live asset carries returns the shared 404 ``tag_not_found`` envelope,
    as does an unknown ``project_id``; a malformed id or an out-of-range
    ``recent_limit`` uses the shared 422 ``validation_error`` envelope.
    """
    return overview.overview(tag, project_id=project_id, recent_limit=recent_limit)


__all__ = ["router"]
