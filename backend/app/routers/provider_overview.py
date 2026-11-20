"""Authoritative single-provider overview endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..deps import get_provider_overview_repository
from ..repositories.provider_overview import ProviderOverviewRepository
from ..schemas.provider_overview import ProviderOverview

router = APIRouter(tags=["providers", "overview"])


@router.get("/providers/{provider_id}/overview", response_model=ProviderOverview)
def provider_overview(
    provider_id: str,
    overview: Annotated[
        ProviderOverviewRepository, Depends(get_provider_overview_repository)
    ],
) -> ProviderOverview:
    """Return a compact snapshot of one provider, derived from authoritative data.

    An unknown provider returns the shared 404 ``provider_not_found`` envelope.
    """
    return overview.overview(provider_id)


__all__ = ["router"]
