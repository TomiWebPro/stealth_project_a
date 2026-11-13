"""Health and version endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..config import APP_VERSION
from ..deps import get_store
from ..schemas.common import API_VERSION, HealthResponse, VersionResponse
from ..storage.base import DocumentStore

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(store: Annotated[DocumentStore, Depends(get_store)]) -> HealthResponse:
    """Liveness/readiness probe.

    ``status`` is ``ok`` when the configured store answers a ping, ``down``
    otherwise. The endpoint stays 200 either way so supervisors can read the
    payload; use ``status`` for gating.
    """
    return HealthResponse(
        status="ok" if store.ping() else "down",
        version=APP_VERSION,
    )


@router.get("/version", response_model=VersionResponse)
def version() -> VersionResponse:
    return VersionResponse(api_version=API_VERSION, build=APP_VERSION)


__all__ = ["router"]
