"""Authoritative organization/membership statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_organization_stats_repository
from ..repositories.organization_stats import OrganizationStatsRepository
from ..schemas.organization_stats import OrganizationStats

router = APIRouter(tags=["organizations", "statistics"])


@router.get("/orgs/stats", response_model=OrganizationStats)
@router.get(
    "/organizations/stats", response_model=OrganizationStats, include_in_schema=False
)
def get_organization_stats(
    organization_stats: Annotated[
        OrganizationStatsRepository, Depends(get_organization_stats_repository)
    ],
    org_id: Annotated[UUID | None, Query(description="Scope to one organization")] = None,
) -> OrganizationStats:
    """Membership metrics derived from the authoritative auth store.

    Zero-filled role breakdowns, per-organization member counts, global user
    total, average members per organization and newest-organization recency. An
    unknown ``org_id`` yields a zero-filled snapshot (like ``GET /orgs?org_id=``);
    a malformed ``org_id`` uses the shared 422 validation envelope.
    """
    return organization_stats.stats(org_id=org_id)


__all__ = ["router"]
