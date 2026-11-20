"""Authoritative single collaboration-signal overview endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_collaboration_overview_repository
from ..repositories.collaboration_overview import CollaborationOverviewRepository
from ..schemas.collaboration_overview import CollaborationOverview

router = APIRouter(tags=["collaboration", "overview"])


@router.get(
    "/collaboration/{signal_key}/overview",
    response_model=CollaborationOverview,
)
def collaboration_overview(
    signal_key: str,
    overview: Annotated[
        CollaborationOverviewRepository, Depends(get_collaboration_overview_repository)
    ],
    recent_limit: Annotated[
        int,
        Query(ge=1, le=50, description="How many recent sibling signals to include"),
    ] = 5,
) -> CollaborationOverview:
    """Return a compact snapshot of one workspace collaboration signal.

    ``signal_key`` is ``<signal>:<project_id>:<signal_id>`` where ``signal`` is
    ``presence`` or ``comment``. A malformed key uses the shared 422
    ``validation_error`` envelope; a well-formed key with no matching live signal
    uses the shared 404 ``collaboration_signal_not_found`` envelope. An
    out-of-range ``recent_limit`` uses the shared 422 envelope.
    """
    return overview.overview(signal_key, recent_limit=recent_limit)


__all__ = ["router"]
