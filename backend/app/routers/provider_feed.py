"""Authoritative provider-feed endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_provider_feed_repository
from ..repositories.provider_feed import ProviderFeedRepository
from ..schemas.provider import ProviderLocation, ProviderStatus
from ..schemas.provider_feed import ProviderFeed

router = APIRouter(tags=["providers", "feed"])


@router.get("/providers/feed", response_model=ProviderFeed)
def get_provider_feed(
    provider_feed: Annotated[
        ProviderFeedRepository, Depends(get_provider_feed_repository)
    ],
    location: Annotated[
        ProviderLocation | None, Query(description="Scope to one runtime location")
    ] = None,
    status: Annotated[
        ProviderStatus | None, Query(description="Scope to one health status")
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> ProviderFeed:
    """Return providers in a deterministic, bounded feed from the authoritative store.

    Each item is projected from a ``PROVIDERS`` record with its advertised
    operation ids and capability count. Optional ``location``/``status`` filters
    narrow the same derivation (and the whole-scope ``total``); an invalid filter
    value or ``limit`` uses the shared 422 validation envelope.
    """
    return provider_feed.feed(location=location, status=status, limit=limit)


__all__ = ["router"]
