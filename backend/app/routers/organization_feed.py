"""Authoritative organization-feed endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_organization_feed_repository
from ..repositories.organization_feed import OrganizationFeedRepository
from ..schemas.organization_feed import OrganizationFeed

router = APIRouter(tags=["organizations", "feed"])


@router.get("/orgs/feed", response_model=OrganizationFeed)
@router.get(
    "/organizations/feed", response_model=OrganizationFeed, include_in_schema=False
)
def get_organization_feed(
    organization_feed: Annotated[
        OrganizationFeedRepository, Depends(get_organization_feed_repository)
    ],
    limit: Annotated[
        int,
        Query(ge=1, le=200, description="Maximum feed items to return"),
    ] = 50,
) -> OrganizationFeed:
    """Return organizations newest-first from the authoritative store.

    Each item is projected from an ``ORGANIZATIONS`` record with member/project
    activity counts joined from the authoritative membership and project stores.
    An invalid ``limit`` uses the shared 422 envelope.
    """
    return organization_feed.feed(limit=limit)


__all__ = ["router"]
