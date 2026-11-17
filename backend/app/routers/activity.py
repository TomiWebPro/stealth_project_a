"""Authoritative workspace activity feed endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_activity_repository
from ..repositories.activity import ActivityRepository
from ..schemas.activity import ActivityFeed, ActivityKind

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=ActivityFeed)
def workspace_activity(
    activity: Annotated[ActivityRepository, Depends(get_activity_repository)],
    project_id: Annotated[UUID | None, Query(description="Scope to one project")] = None,
    kind: Annotated[ActivityKind | None, Query(description="Filter to one event kind")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> ActivityFeed:
    """Newest-first workspace activity derived from the authoritative stores.

    Unknown projects return the shared 404 error envelope; invalid filters
    (bad kind, project id or limit) use the shared 422 validation envelope.
    """
    return activity.feed(project_id=project_id, kind=kind, limit=limit)


__all__ = ["router"]
