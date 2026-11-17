"""Provider discovery and capability query endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ..deps import get_provider_repository
from ..repositories.providers import ProviderRepository
from ..schemas.provider import CapabilityQuery, Provider, ProviderLocation

router = APIRouter(tags=["providers"])


@router.get("/providers", response_model=list[Provider])
def list_providers(
    providers: Annotated[ProviderRepository, Depends(get_provider_repository)],
) -> list[Provider]:
    return providers.list()


@router.get("/capabilities", response_model=list[Provider])
def query_capabilities(
    providers: Annotated[ProviderRepository, Depends(get_provider_repository)],
    operation_id: Annotated[
        str | None, Query(description="Only providers supporting this operation")
    ] = None,
    location: Annotated[
        ProviderLocation | None, Query(description="Filter by provider location")
    ] = None,
) -> list[Provider]:
    """Discover providers by operation and/or location.

    Returns ``Provider`` contracts with their capability list narrowed to the
    queried operation, reusing the existing mirrored schemas.
    """
    return providers.capabilities(
        CapabilityQuery(operation_id=operation_id, location=location)
    )


@router.get("/providers/{provider_id}", response_model=Provider)
def get_provider(
    provider_id: str,
    providers: Annotated[ProviderRepository, Depends(get_provider_repository)],
) -> Provider:
    return providers.get_or_raise(provider_id)


__all__ = ["router"]
