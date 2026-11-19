"""Authoritative operation catalog feed endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_operation_feed_repository
from ..repositories.operation_feed import OperationFeedRepository
from ..schemas.operation_feed import OperationFeed

router = APIRouter(tags=["operations", "feed"])


@router.get("/operations/feed", response_model=OperationFeed)
def get_operation_feed(
    operation_feed: Annotated[OperationFeedRepository, Depends(get_operation_feed_repository)],
    streaming: Annotated[
        bool | None,
        Query(description="Filter to streaming or non-streaming operations"),
    ] = None,
    provider_id: Annotated[
        str | None,
        Query(description="Filter to operations bound to one provider"),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> OperationFeed:
    """Return operations from the authoritative catalog in deterministic order.

    A compact projection of each operation with identity/display fields, asset
    types, settings count, streaming flag and sorted/deduplicated provider
    bindings. ``total`` counts all operations in scope before the ``limit`` page.
    Invalid ``streaming``, ``provider_id`` or ``limit`` uses the shared 422
    envelope.
    """
    return operation_feed.feed(streaming=streaming, provider_id=provider_id, limit=limit)


__all__ = ["router"]
