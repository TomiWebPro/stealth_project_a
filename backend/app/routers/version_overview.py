"""Authoritative single asset-version overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query

from ..deps import get_version_overview_repository
from ..repositories.version_overview import VersionOverviewRepository
from ..schemas.version_overview import VersionOverview

router = APIRouter(tags=["assets", "versions", "overview"])


@router.get(
    "/assets/{asset_id}/versions/{version}/overview",
    response_model=VersionOverview,
)
def version_overview(
    asset_id: UUID,
    version: Annotated[int, Path(ge=1, description="The version number to inspect")],
    overview: Annotated[
        VersionOverviewRepository, Depends(get_version_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many sibling version records to include"),
    ] = 5,
) -> VersionOverview:
    """Return a compact snapshot of one version of one asset.

    An unknown asset returns the shared 404 ``asset_not_found`` envelope, a
    version that does not exist uses the shared 404 ``version_not_found``
    envelope, and a malformed id/version or an out-of-range ``recent_limit``
    uses the shared 422 ``validation_error`` envelope.
    """
    return overview.overview(asset_id, version, recent_limit=recent_limit)


__all__ = ["router"]
