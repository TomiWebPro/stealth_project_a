"""Authoritative single-orchestration-run overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_run_overview_repository
from ..repositories.run_overview import RunOverviewRepository
from ..schemas.run_overview import RunOverview

router = APIRouter(tags=["orchestration", "overview"])


@router.get("/orchestration/runs/{run_id}/overview", response_model=RunOverview)
def run_overview(
    run_id: UUID,
    overview: Annotated[
        RunOverviewRepository, Depends(get_run_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent linked jobs to include"),
    ] = 5,
) -> RunOverview:
    """Return a compact snapshot of one orchestration run, derived from authoritative stores.

    An unknown run returns the shared 404 ``run_not_found`` envelope; a
    malformed id or an out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(run_id, recent_limit=recent_limit)


__all__ = ["router"]
