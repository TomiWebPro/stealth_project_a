"""Authoritative single-orchestration-plan overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_plan_overview_repository
from ..repositories.plan_overview import PlanOverviewRepository
from ..schemas.plan_overview import PlanOverview

router = APIRouter(tags=["orchestration", "overview"])


@router.get("/orchestration/plans/{plan_id}/overview", response_model=PlanOverview)
def plan_overview(
    plan_id: UUID,
    overview: Annotated[
        PlanOverviewRepository, Depends(get_plan_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent runs to include"),
    ] = 5,
) -> PlanOverview:
    """Return a compact snapshot of one orchestration plan, derived from authoritative stores.

    An unknown plan returns the shared 404 ``plan_not_found`` envelope; a
    malformed id or an out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(plan_id, recent_limit=recent_limit)


__all__ = ["router"]
