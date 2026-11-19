"""Authoritative upload statistics endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_upload_stats_repository
from ..repositories.upload_stats import UploadStatsRepository
from ..schemas.upload_stats import UploadStats

router = APIRouter(tags=["uploads", "statistics"])


@router.get("/uploads/stats", response_model=UploadStats)
def get_upload_stats(
    upload_stats: Annotated[UploadStatsRepository, Depends(get_upload_stats_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
) -> UploadStats:
    """Upload-ticket metrics derived from the authoritative upload store.

    Zero-filled per-status breakdown (pending/complete), per-project activity,
    completed byte totals, newest-ticket recency and generation time. An unknown
    ``project_id`` raises the shared 404 envelope; a malformed ``project_id``
    uses the shared 422 validation envelope.
    """
    return upload_stats.stats(project_id=project_id)


__all__ = ["router"]
