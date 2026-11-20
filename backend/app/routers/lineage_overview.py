"""Authoritative single lineage-relationship overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_lineage_overview_repository
from ..repositories.lineage_overview import LineageOverviewRepository
from ..schemas.lineage_overview import LineageOverview

router = APIRouter(tags=["assets", "lineage", "overview"])


@router.get("/lineage/{relationship_id}/overview", response_model=LineageOverview)
def lineage_overview(
    relationship_id: UUID,
    overview: Annotated[
        LineageOverviewRepository, Depends(get_lineage_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many source-asset links to include"),
    ] = 5,
) -> LineageOverview:
    """Return a compact snapshot of one typed asset relationship.

    An unknown relationship (or one whose source asset is soft-deleted/unknown)
    returns the shared 404 ``relationship_not_found`` envelope; a malformed id or
    out-of-range ``recent_limit`` uses the shared 422 ``validation_error`` envelope.
    """
    return overview.overview(relationship_id, recent_limit=recent_limit)


__all__ = ["router"]
