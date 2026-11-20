"""Authoritative single-user overview endpoint."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from ..deps import get_user_overview_repository
from ..repositories.user_overview import UserOverviewRepository
from ..schemas.user_overview import UserOverview

router = APIRouter(tags=["auth", "collaboration", "overview"])


@router.get("/users/{user_id}/overview", response_model=UserOverview)
def user_overview(
    user_id: UUID,
    overview: Annotated[UserOverviewRepository, Depends(get_user_overview_repository)],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent projects/comments to include"),
    ] = 5,
) -> UserOverview:
    """Return a compact profile snapshot for one user.

    An unknown user returns the shared 404 ``user_not_found`` envelope; a malformed
    id or out-of-range ``recent_limit`` uses the shared 422 ``validation_error``
    envelope.
    """
    return overview.overview(user_id, recent_limit=recent_limit)


__all__ = ["router"]
