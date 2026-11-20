"""Authoritative single-organization overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_organization_overview_repository
from ..repositories.organization_overview import OrganizationOverviewRepository
from ..schemas.organization_overview import OrganizationOverview

router = APIRouter(tags=["organizations", "overview"])


@router.get("/orgs/{org_id}/overview", response_model=OrganizationOverview)
@router.get(
    "/organizations/{org_id}/overview",
    response_model=OrganizationOverview,
    include_in_schema=False,
)
def organization_overview(
    org_id: UUID,
    overview: Annotated[
        OrganizationOverviewRepository, Depends(get_organization_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent members/projects to include"),
    ] = 5,
) -> OrganizationOverview:
    """Return a compact snapshot of one organization, derived from authoritative stores.

    An unknown organization returns the shared 404 ``organization_not_found``
    envelope; a malformed id or an out-of-range ``recent_limit`` uses the shared
    422 ``validation_error`` envelope.
    """
    return overview.overview(org_id, recent_limit=recent_limit)


__all__ = ["router"]
