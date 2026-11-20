"""Authoritative single-extension overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from ..deps import get_extension_overview_repository
from ..repositories.extension_overview import ExtensionOverviewRepository
from ..schemas.extension_overview import ExtensionOverview

router = APIRouter(tags=["extensions", "overview"])


@router.get("/extensions/{extension_id}/overview", response_model=ExtensionOverview)
def extension_overview(
    extension_id: UUID,
    overview: Annotated[
        ExtensionOverviewRepository, Depends(get_extension_overview_repository)
    ],
) -> ExtensionOverview:
    """Return a compact snapshot of one extension, derived from authoritative data.

    An unknown extension returns the shared 404 ``extension_not_found`` envelope;
    a malformed id uses the shared 422 ``validation_error`` envelope.
    """
    return overview.overview(extension_id)


__all__ = ["router"]
