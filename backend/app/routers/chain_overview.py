"""Authoritative single-pipeline-chain overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_chain_overview_repository
from ..repositories.chain_overview import ChainOverviewRepository
from ..schemas.chain_overview import ChainOverview

router = APIRouter(tags=["pipelines", "overview"])


@router.get("/pipelines/{chain_id}/overview", response_model=ChainOverview)
def chain_overview(
    chain_id: UUID,
    overview: Annotated[
        ChainOverviewRepository, Depends(get_chain_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent jobs/assets to include"),
    ] = 5,
) -> ChainOverview:
    """Return a compact snapshot of one pipeline chain, derived from authoritative stores.

    An unknown chain returns the shared 404 ``chain_not_found`` envelope; a
    malformed id or an out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(chain_id, recent_limit=recent_limit)


__all__ = ["router"]
