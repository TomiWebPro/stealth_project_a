"""Authoritative extension registry/installation statistics endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_extension_stats_repository
from ..repositories.extension_stats import ExtensionStatsRepository
from ..schemas.extension_stats import ExtensionStats
from ..schemas.provider import ExtensionStatus, ExtensionType

router = APIRouter(tags=["extensions", "statistics"])


@router.get("/extensions/stats", response_model=ExtensionStats)
def get_extension_stats(
    extension_stats: Annotated[
        ExtensionStatsRepository, Depends(get_extension_stats_repository)
    ],
    extension_type: Annotated[
        ExtensionType | None,
        Query(alias="type", description="Scope registry metrics to one extension type"),
    ] = None,
    status: Annotated[
        ExtensionStatus | None,
        Query(description="Scope installation metrics to one lifecycle status"),
    ] = None,
) -> ExtensionStats:
    """Registry/installation metrics derived from the authoritative stores.

    Zero-filled type/status breakdowns, trust flags and permission/capability
    coverage. Optional ``type``/``status`` filters narrow the same derivation;
    an invalid filter value uses the shared 422 validation envelope.
    """
    return extension_stats.stats(type=extension_type, status=status)


__all__ = ["router"]
