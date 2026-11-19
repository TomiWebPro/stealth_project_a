"""Authoritative provider fleet statistics endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_provider_stats_repository
from ..repositories.provider_stats import ProviderStatsRepository
from ..schemas.provider import ProviderLocation, ProviderStatus
from ..schemas.provider_stats import ProviderStats

router = APIRouter(tags=["providers", "statistics"])


@router.get("/providers/stats", response_model=ProviderStats)
def get_provider_stats(
    provider_stats: Annotated[
        ProviderStatsRepository, Depends(get_provider_stats_repository)
    ],
    location: Annotated[
        ProviderLocation | None, Query(description="Scope to one runtime location")
    ] = None,
    status: Annotated[
        ProviderStatus | None, Query(description="Scope to one health status")
    ] = None,
) -> ProviderStats:
    """Fleet metrics derived from the authoritative provider store.

    Zero-filled health/location breakdowns, capability coverage and per-operation
    counts. Optional ``location``/``status`` filters narrow the same derivation;
    an invalid filter value uses the shared 422 validation envelope.
    """
    return provider_stats.stats(location=location, status=status)


__all__ = ["router"]
