"""Authoritative single-capability overview endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..deps import get_capability_overview_repository
from ..repositories.capability_overview import CapabilityOverviewRepository
from ..schemas.capability_overview import CapabilityOverview

router = APIRouter(tags=["capabilities", "overview"])


@router.get(
    "/capabilities/{operation_id}/overview",
    response_model=CapabilityOverview,
)
def capability_overview(
    operation_id: str,
    overview: Annotated[CapabilityOverviewRepository, Depends(get_capability_overview_repository)],
) -> CapabilityOverview:
    """Return a compact snapshot of one capability.

    A capability is known when it exists in the authoritative operation catalog
    or is advertised by at least one provider. Anything else uses the shared 404
    ``capability_not_found`` envelope; the request-id header is set on every path.
    """
    return overview.overview(operation_id)


__all__ = ["router"]
