"""Authoritative downstream asset impact endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_impact_repository
from ..repositories.impact import ImpactRepository
from ..schemas.impact import AssetImpact

router = APIRouter(prefix="/assets", tags=["assets", "impact"])


@router.get("/{asset_id}/impact", response_model=AssetImpact)
def asset_impact(
    asset_id: UUID,
    impact: Annotated[ImpactRepository, Depends(get_impact_repository)],
    max_depth: Annotated[int, Query(ge=1, le=20)] = 5,
) -> AssetImpact:
    """Transitive downstream impact of ``asset_id``, derived from the store.

    The breadth-first descendant list excludes deleted assets and is bounded by
    ``max_depth``. An unknown asset returns the shared 404 error envelope;
    an invalid ``max_depth`` uses the shared 422 envelope.
    """
    return impact.impact(asset_id, max_depth=max_depth)


__all__ = ["router"]
