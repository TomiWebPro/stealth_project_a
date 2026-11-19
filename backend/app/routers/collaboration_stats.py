"""Authoritative collaboration statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_collaboration_stats_repository
from ..repositories.collaboration_stats import CollaborationStatsRepository
from ..schemas.collaboration_stats import CollaborationStats

router = APIRouter(tags=["collaboration", "statistics"])


@router.get("/collaboration/stats", response_model=CollaborationStats)
def get_collaboration_stats(
    collaboration_stats: Annotated[
        CollaborationStatsRepository, Depends(get_collaboration_stats_repository)
    ],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> CollaborationStats:
    """Collaboration metrics derived from the authoritative presence/comment stores.

    Zero-filled presence-state breakdowns, per-project activity counts, distinct
    participant count and newest-signal recency. An unknown ``project_id`` raises
    the shared 404 envelope; a malformed ``project_id`` uses the shared 422
    validation envelope.
    """
    return collaboration_stats.stats(project_id=project_id)


__all__ = ["router"]
