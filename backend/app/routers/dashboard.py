"""Authoritative dashboard summary endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_dashboard_repository
from ..repositories.dashboard import DashboardRepository
from ..schemas.dashboard import DashboardSummary

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard_summary(
    dashboard_repo: Annotated[DashboardRepository, Depends(get_dashboard_repository)],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent jobs/assets to include"),
    ] = 5,
) -> DashboardSummary:
    """Workspace snapshot derived from the authoritative stores.

    Invalid ``recent_limit`` values are rejected with the shared 422 validation
    envelope. An empty workspace returns zero counts, zero-filled breakdowns and
    empty ``recent_*`` lists — never an error.
    """
    return dashboard_repo.summary(recent_limit=recent_limit)


__all__ = ["router"]
