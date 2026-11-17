"""Adapter inventory/health and simulated job execution endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from ..adapters import AdapterRegistry
from ..deps import get_adapter_registry, get_job_repository
from ..errors import InvalidRequestError
from ..repositories.jobs import JobRepository
from ..schemas.operation import Job
from ..schemas.provider import ProviderLocation, ProviderStatus

router = APIRouter(tags=["adapters"])


class AdapterInfo(BaseModel):
    provider_id: str
    name: str
    location: ProviderLocation
    status: ProviderStatus
    operations: list[str]


class AdapterHealth(BaseModel):
    provider_id: str
    status: ProviderStatus
    simulated: bool


@router.get("/adapters", response_model=list[AdapterInfo])
def list_adapters(
    registry: Annotated[AdapterRegistry, Depends(get_adapter_registry)],
) -> list[AdapterInfo]:
    return [
        AdapterInfo(
            provider_id=adapter.provider_id,
            name=adapter.name,
            location=adapter.location,
            status=adapter.health(),
            operations=[
                op
                for op in (
                    "text-to-text",
                    "text-to-image",
                    "image-to-image",
                    "upscale",
                    "image-to-video",
                    "lora-train",
                    "splat-train",
                )
                if adapter.supports(op)
            ],
        )
        for adapter in registry.list()
    ]


@router.get("/adapters/{provider_id}/health", response_model=AdapterHealth)
def adapter_health(
    provider_id: str,
    registry: Annotated[AdapterRegistry, Depends(get_adapter_registry)],
) -> AdapterHealth:
    adapter = registry.get(provider_id)
    if adapter is None:
        raise InvalidRequestError(
            f"Unknown adapter '{provider_id}'.", code="unknown_adapter"
        )
    return AdapterHealth(
        provider_id=provider_id,
        status=adapter.health(),
        simulated=True,
    )


@router.post("/jobs/{job_id}/run", response_model=Job)
def run_job(
    job_id: UUID,
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
    registry: Annotated[AdapterRegistry, Depends(get_adapter_registry)],
    provider_id: Annotated[
        str | None, Query(description="Preferred adapter provider id")
    ] = None,
) -> Job:
    """Execute a queued job through a runtime adapter (simulated, CPU-only)."""
    job = jobs.get_or_raise(job_id)
    if provider_id is not None and registry.get(provider_id) is None:
        raise InvalidRequestError(
            f"Unknown adapter '{provider_id}'.", code="unknown_adapter"
        )
    adapter = registry.for_operation(job.operation_id, preferred=provider_id)
    if adapter is None:
        raise InvalidRequestError(
            f"No adapter supports operation '{job.operation_id}'.",
            code="no_adapter",
            details=[("operation_id", "no runtime adapter available")],
        )

    jobs.start(job_id)
    result = adapter.execute(
        job.operation_id,
        {},
        emit=lambda **kwargs: jobs.append_event(job_id, "progress", **kwargs),
    )
    return jobs.complete(job_id, result)


__all__ = ["router", "AdapterInfo", "AdapterHealth"]
