"""Authoritative extension installation feed endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_extension_feed_repository
from ..repositories.extension_feed import ExtensionFeedRepository
from ..schemas.extension_feed import ExtensionFeed
from ..schemas.provider import ExtensionStatus, ExtensionType

router = APIRouter(tags=["extensions", "feed"])


@router.get("/extensions/feed", response_model=ExtensionFeed)
def get_extension_feed(
    extension_feed: Annotated[ExtensionFeedRepository, Depends(get_extension_feed_repository)],
    extension_type: Annotated[
        ExtensionType | None,
        Query(alias="type", description="Filter to one extension type"),
    ] = None,
    status: Annotated[
        ExtensionStatus | None,
        Query(description="Filter to one lifecycle status"),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> ExtensionFeed:
    """Return installed extensions newest-first from the authoritative store.

    Each item is projected from an ``EXTENSIONS`` record with its manifest
    display fields and trust flags. An invalid ``type``, ``status`` or ``limit``
    uses the shared 422 validation envelope; ``total`` counts the whole filtered
    feed before the ``limit`` page is applied.
    """
    return extension_feed.feed(type=extension_type, status=status, limit=limit)


__all__ = ["router"]
