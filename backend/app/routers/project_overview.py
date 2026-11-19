"""Authoritative single-project overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_project_overview_repository
from ..repositories.project_overview import ProjectOverviewRepository
from ..schemas.project_overview import ProjectOverview

router = APIRouter(tags=["projects", "overview"])


@router.get("/projects/{project_id}/overview", response_model=ProjectOverview)
def project_overview(
    project_id: UUID,
    overview: Annotated[
        ProjectOverviewRepository, Depends(get_project_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent jobs/assets to include"),
    ] = 5,
) -> ProjectOverview:
    """Return a compact snapshot of one project, derived from authoritative stores.

    An unknown project returns the shared 404 ``project_not_found`` envelope; a
    malformed id or an out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(project_id, recent_limit=recent_limit)


__all__ = ["router"]
