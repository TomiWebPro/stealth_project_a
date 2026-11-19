"""Authoritative search index statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_search_stats_repository
from ..repositories.search_stats import SearchStatsRepository
from ..schemas.search_stats import SearchStats

router = APIRouter(tags=["search", "statistics"])


@router.get("/search/stats", response_model=SearchStats)
def get_search_stats(
    search_stats: Annotated[SearchStatsRepository, Depends(get_search_stats_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> SearchStats:
    """Searchable-document metrics derived from the authoritative stores.

    Zero-filled per-kind breakdowns (project/asset/conversation), total indexed
    documents, newest-document recency and generation time. Soft-deleted assets
    are excluded. An unknown ``project_id`` raises the shared 404 envelope; a
    malformed ``project_id`` uses the shared 422 validation envelope.
    """
    return search_stats.stats(project_id=project_id)


__all__ = ["router"]
