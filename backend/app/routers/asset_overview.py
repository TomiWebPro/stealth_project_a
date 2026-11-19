"""Authoritative single-asset overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_asset_overview_repository
from ..repositories.asset_overview import AssetOverviewRepository
from ..schemas.asset_overview import AssetOverview

router = APIRouter(tags=["assets", "overview"])


@router.get("/assets/{asset_id}/overview", response_model=AssetOverview)
def asset_overview(
    asset_id: UUID,
    overview: Annotated[
        AssetOverviewRepository, Depends(get_asset_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent version records to include"),
    ] = 5,
) -> AssetOverview:
    """Return a compact snapshot of one asset, derived from authoritative stores.

    An unknown asset returns the shared 404 ``asset_not_found`` envelope; a
    malformed id or an out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(asset_id, recent_limit=recent_limit)


__all__ = ["router"]
