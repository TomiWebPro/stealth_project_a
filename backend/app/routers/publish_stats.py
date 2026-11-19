"""Authoritative publish statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_publish_stats_repository
from ..repositories.publish_stats import PublishStatsRepository
from ..schemas.publish_stats import PublishStats

router = APIRouter(tags=["publish", "statistics"])


@router.get("/publishes/stats", response_model=PublishStats)
def get_publish_stats(
    publish_stats: Annotated[PublishStatsRepository, Depends(get_publish_stats_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> PublishStats:
    """Publish metrics derived from authoritative asset publish receipts.

    Total published assets, delivered byte totals, a distribution by version
    number, per-project activity, newest-publish recency and generation time.
    Soft-deleted assets and malformed receipts are excluded. An unknown
    ``project_id`` raises the shared 404 envelope; a malformed ``project_id``
    uses the shared 422 validation envelope.
    """
    return publish_stats.stats(project_id=project_id)


__all__ = ["router"]
