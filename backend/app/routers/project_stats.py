"""Authoritative project portfolio statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_project_stats_repository
from ..repositories.project_stats import ProjectStatsRepository
from ..schemas.project_stats import ProjectStats

router = APIRouter(tags=["projects", "statistics"])


@router.get("/projects/stats", response_model=ProjectStats)
def get_project_stats(
    project_stats: Annotated[ProjectStatsRepository, Depends(get_project_stats_repository)],
    org_id: Annotated[UUID | None, Query(description="Scope to one organization")] = None,
) -> ProjectStats:
    """Project portfolio metrics derived from the authoritative stores.

    Zero-filled lifecycle breakdowns, project/asset/conversation/job totals,
    per-project averages and newest-project recency. Soft-deleted assets are
    excluded. An unknown ``org_id`` simply yields a zero-filled snapshot (like
    ``GET /projects?org_id=``); a malformed ``org_id`` uses the shared 422
    validation envelope.
    """
    return project_stats.stats(org_id=org_id)


__all__ = ["router"]
