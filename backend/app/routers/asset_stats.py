"""Authoritative asset inventory statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_asset_stats_repository
from ..repositories.asset_stats import AssetStatsRepository
from ..schemas.asset_stats import AssetStats

router = APIRouter(tags=["assets", "statistics"])


@router.get("/assets/stats", response_model=AssetStats)
def get_asset_stats(
    asset_stats: Annotated[AssetStatsRepository, Depends(get_asset_stats_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> AssetStats:
    """Asset inventory metrics derived from the authoritative asset store.

    Zero-filled type/status breakdowns, asset count, total stored bytes, total
    version revisions and newest-asset recency. Soft-deleted assets are excluded.
    An unknown project returns the shared 404 error envelope; a malformed
    ``project_id`` uses the shared 422 envelope.
    """
    return asset_stats.stats(project_id=project_id)


__all__ = ["router"]
