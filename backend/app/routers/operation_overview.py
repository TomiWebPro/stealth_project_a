"""Authoritative single-operation overview endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..deps import get_operation_overview_repository
from ..repositories.operation_overview import OperationOverviewRepository
from ..schemas.operation_overview import OperationOverview

router = APIRouter(tags=["operations", "overview"])


@router.get("/operations/{operation_id}/overview", response_model=OperationOverview)
def operation_overview(
    operation_id: str,
    overview: Annotated[
        OperationOverviewRepository, Depends(get_operation_overview_repository)
    ],
) -> OperationOverview:
    """Return a compact snapshot of one operation, derived from authoritative data.

    An unknown operation returns the shared 404 ``operation_not_found`` envelope.
    """
    return overview.overview(operation_id)


__all__ = ["router"]
