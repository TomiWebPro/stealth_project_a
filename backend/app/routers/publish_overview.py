"""Authoritative single publish-receipt overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_publish_overview_repository
from ..repositories.publish_overview import PublishOverviewRepository
from ..schemas.publish_overview import PublishOverview

router = APIRouter(tags=["publishes", "overview"])


@router.get(
    "/publishes/{asset_id}/overview",
    response_model=PublishOverview,
)
def publish_overview(
    asset_id: UUID,
    overview: Annotated[PublishOverviewRepository, Depends(get_publish_overview_repository)],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent sibling publishes to include"),
    ] = 5,
) -> PublishOverview:
    """Return a compact snapshot of one asset's publish receipt.

    An unknown asset returns the shared 404 ``asset_not_found`` envelope, while an
    asset without a well-formed publish receipt returns 404 ``publish_not_found``;
    a malformed id or an out-of-range ``recent_limit`` uses the shared 422
    ``validation_error`` envelope.
    """
    return overview.overview(asset_id, recent_limit=recent_limit)


__all__ = ["router"]
