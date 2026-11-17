"""Operation catalog and job lifecycle endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from ..deps import get_current_user_id, get_job_repository
from ..errors import NotFoundError
from ..repositories.jobs import JobRepository
from ..schemas.operation import (
    Job,
    JobCancelRequest,
    JobEventFrame,
    JobListQuery,
    JobRetryRequest,
    JobStatus,
    OperationCatalog,
    OperationRequest,
    OperationSpec,
)

router = APIRouter(tags=["operations", "jobs"])


# --- Operations -------------------------------------------------------------


@router.get("/operations", response_model=OperationCatalog)
def get_operations(
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
) -> OperationCatalog:
    return jobs.catalog()


@router.get("/operations/{operation_id}", response_model=OperationSpec)
def get_operation(
    operation_id: str,
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
) -> OperationSpec:
    spec = jobs.operation_spec(operation_id)
    if spec is None:
        raise NotFoundError("Operation", operation_id)
    return spec


# --- Jobs -------------------------------------------------------------------


@router.get("/jobs", response_model=list[Job])
def list_jobs(
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
    project_id: Annotated[UUID | None, Query(description="Filter by project")] = None,
    job_status: Annotated[
        JobStatus | None, Query(alias="status", description="Filter by status")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[Job]:
    """List jobs, newest first, using the ``JobListQuery`` contract."""
    return jobs.list(JobListQuery(project_id=project_id, status=job_status, limit=limit))


@router.post("/jobs", response_model=Job, status_code=status.HTTP_201_CREATED)
def submit_job(
    payload: OperationRequest,
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> Job:
    return jobs.submit(payload, user_id=user_id)


@router.get("/jobs/{job_id}", response_model=Job)
def get_job(
    job_id: UUID,
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
) -> Job:
    return jobs.get_or_raise(job_id)


@router.get("/jobs/{job_id}/events", response_model=JobEventFrame)
def get_job_events(
    job_id: UUID,
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
    since: Annotated[
        int,
        Query(ge=0, description="Return events with seq >= since (resume cursor)"),
    ] = 0,
) -> JobEventFrame:
    """Recoverable event stream: resume from the last observed ``seq``."""
    return jobs.event_frame(job_id, since=since)


@router.post("/jobs/{job_id}/cancel", response_model=Job)
def cancel_job(
    job_id: UUID,
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
    payload: JobCancelRequest | None = None,
) -> Job:
    return jobs.cancel(job_id, reason=payload.reason if payload else None)


@router.post("/jobs/{job_id}/retry", response_model=Job)
def retry_job(
    job_id: UUID,
    payload: JobRetryRequest,
    jobs: Annotated[JobRepository, Depends(get_job_repository)],
) -> Job:
    return jobs.retry(job_id, idempotency_key=payload.idempotency_key)


__all__ = ["router"]
