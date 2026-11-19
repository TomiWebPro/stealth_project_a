"""Authoritative asset version statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_version_stats_repository
from ..repositories.version_stats import VersionStatsRepository
from ..schemas.version_stats import VersionStats

router = APIRouter(tags=["assets", "statistics"])


@router.get("/versions/stats", response_model=VersionStats)
def get_version_stats(
    version_stats: Annotated[VersionStatsRepository, Depends(get_version_stats_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> VersionStats:
    """Version metrics derived from the authoritative asset version store.

    Total version records, distinct versioned assets, revision count, a
    distribution by version number, per-project activity, newest-version
    recency and generation time. Versions of soft-deleted/unknown assets are
    excluded. An unknown ``project_id`` raises the shared 404 envelope; a
    malformed ``project_id`` uses the shared 422 validation envelope.
    """
    return version_stats.stats(project_id=project_id)


__all__ = ["router"]
