"""Authoritative single-organization-membership overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_membership_overview_repository
from ..repositories.membership_overview import MembershipOverviewRepository
from ..schemas.membership_overview import MembershipOverview

router = APIRouter(tags=["auth", "collaboration", "overview"])


@router.get("/orgs/{org_id}/members/{user_id}/overview", response_model=MembershipOverview)
def membership_overview(
    org_id: UUID,
    user_id: UUID,
    overview: Annotated[MembershipOverviewRepository, Depends(get_membership_overview_repository)],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent projects/comments to include"),
    ] = 5,
) -> MembershipOverview:
    """Return a compact snapshot of one user's membership in one organization.

    An unknown org/user or a missing membership returns the shared 404 envelope
    (``organization_not_found`` / ``user_not_found`` / ``membership_not_found``);
    a malformed id or out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(org_id, user_id, recent_limit=recent_limit)


__all__ = ["router"]
