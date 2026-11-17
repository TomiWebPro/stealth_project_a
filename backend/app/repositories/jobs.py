"""Operation catalog access and job lifecycle repository.

Jobs and their event streams are persisted through the same document store as
the other domains, so behaving identically under the in-memory and SQLite
adapters is covered by the shared test fixture.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from ..catalog import OPERATION_CATALOG, get_operation_spec
from ..errors import ConflictError, InvalidRequestError, NotFoundError
from ..schemas.common import utcnow
from ..schemas.operation import (
    Job,
    JobEvent,
    JobEventFrame,
    JobEventType,
    JobListQuery,
    JobStatus,
    OperationCatalog,
    OperationRequest,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

# Lifecycle transitions accepted by the mutating endpoints.
_CANCELABLE: frozenset[str] = frozenset({"queued", "running"})
_RETRYABLE: frozenset[str] = frozenset({"failed", "canceled"})


class JobRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    # --- Catalog ------------------------------------------------------------

    def catalog(self) -> OperationCatalog:
        return OPERATION_CATALOG

    def operation_spec(self, operation_id: str):
        return get_operation_spec(operation_id)

    # --- Jobs ---------------------------------------------------------------

    def get(self, job_id: UUID) -> Job | None:
        return self._load(Collections.JOBS, str(job_id), Job)

    def get_or_raise(self, job_id: UUID) -> Job:
        job = self.get(job_id)
        if job is None:
            raise NotFoundError("Job", str(job_id))
        return job

    def list(self, query: JobListQuery) -> list[Job]:
        jobs = self._load_all(Collections.JOBS, Job)
        if query.project_id is not None:
            jobs = [job for job in jobs if job.project_id == query.project_id]
        if query.status is not None:
            jobs = [job for job in jobs if job.status == query.status]
        # Newest first; id is the stable tie-breaker for same-timestamp jobs.
        jobs.sort(key=lambda job: (job.created_at, str(job.id)), reverse=True)
        return jobs[: query.limit]

    def submit(self, payload: OperationRequest, *, user_id: UUID) -> Job:
        spec = get_operation_spec(payload.operation_id)
        if spec is None:
            raise InvalidRequestError(
                f"Unknown operation '{payload.operation_id}'.",
                code="unknown_operation",
                details=[("operation_id", "no such operation in the catalog")],
            )
        if payload.schema_version != spec.schema_version:
            raise InvalidRequestError(
                f"Operation '{payload.operation_id}' expects schema version "
                f"'{spec.schema_version}', got '{payload.schema_version}'.",
                code="schema_version_mismatch",
                details=[("schema_version", f"expected {spec.schema_version}")],
            )
        project = self.projects.get_or_raise(payload.project_id)
        if project.archived:
            raise InvalidRequestError(
                f"Project '{project.id}' is archived; jobs cannot be submitted.",
                code="project_archived",
            )

        now = self.clock()
        job = Job(
            id=uuid4(),
            project_id=payload.project_id,
            operation_id=payload.operation_id,
            schema_version=payload.schema_version,
            status="queued",
            progress=0.0,
            attempt=1,
            created_by=user_id,
            created_at=now,
        )
        self._save(Collections.JOBS, str(job.id), job)
        self._append_event(job.id, "status", status="queued", message="Job queued.")
        return job

    def cancel(self, job_id: UUID, *, reason: str | None = None) -> Job:
        job = self.get_or_raise(job_id)
        if job.status not in _CANCELABLE:
            raise ConflictError(
                f"Job '{job_id}' cannot be canceled in status '{job.status}'.",
                code="job_not_cancelable",
            )
        document = job.model_dump(mode="json")
        document["status"] = "canceled"
        document["finished_at"] = self.clock().isoformat()
        updated = Job.model_validate(document)
        self._save(Collections.JOBS, str(job_id), updated)
        self._append_event(
            job_id,
            "status",
            status="canceled",
            message=reason or "Job canceled.",
        )
        return updated

    def retry(self, job_id: UUID, *, idempotency_key: str) -> Job:
        # Idempotency check happens before the state check so a replay of a
        # successful retry always returns the same result, even if the job has
        # since moved on to another status.
        idem_id = f"{job_id}:{idempotency_key}"
        if self.store.get(Collections.JOB_RETRIES, idem_id) is not None:
            return self.get_or_raise(job_id)

        job = self.get_or_raise(job_id)
        if job.status not in _RETRYABLE:
            raise ConflictError(
                f"Job '{job_id}' cannot be retried in status '{job.status}'.",
                code="job_not_retryable",
            )
        document = job.model_dump(mode="json")
        attempt = job.attempt + 1
        document.update(
            status="queued",
            progress=0.0,
            result=None,
            error=None,
            attempt=attempt,
            started_at=None,
            finished_at=None,
        )
        updated = Job.model_validate(document)
        self._save(Collections.JOBS, str(job_id), updated)
        self.store.put(Collections.JOB_RETRIES, idem_id, {"job_id": str(job_id)})
        self._append_event(
            job_id,
            "status",
            status="queued",
            message=f"Job retried (attempt {attempt}).",
        )
        return updated

    # --- Events -------------------------------------------------------------

    def event_frame(self, job_id: UUID, *, since: int = 0) -> JobEventFrame:
        """Return events with ``seq >= since`` plus a resume cursor."""
        self.get_or_raise(job_id)
        events = [
            event
            for event in self._events(job_id)
            if event.seq >= since
        ]
        next_seq = events[-1].seq + 1 if events else since
        return JobEventFrame(job_id=job_id, events=events, next_seq=next_seq)

    def append_event(
        self,
        job_id: UUID,
        event_type: JobEventType,
        *,
        status: JobStatus | None = None,
        progress: float | None = None,
        message: str | None = None,
    ) -> JobEvent:
        """Append an event to a job's stream (used by transports/workers)."""
        self.get_or_raise(job_id)
        return self._append_event(
            job_id,
            event_type,
            status=status,
            progress=progress,
            message=message,
        )

    # --- Internals ----------------------------------------------------------

    def _events(self, job_id: UUID) -> list[JobEvent]:
        events = [
            JobEvent.model_validate(document)
            for document in self.store.all(Collections.JOB_EVENTS)
            if document.get("job_id") == str(job_id)
        ]
        events.sort(key=lambda event: event.seq)
        return events

    def _append_event(
        self,
        job_id: UUID,
        event_type: JobEventType,
        *,
        status: JobStatus | None = None,
        progress: float | None = None,
        message: str | None = None,
    ) -> JobEvent:
        seq = len(self._events(job_id))
        event = JobEvent(
            type=event_type,
            job_id=job_id,
            seq=seq,
            status=status,
            progress=progress,
            message=message,
            timestamp=self.clock(),
        )
        self._save(Collections.JOB_EVENTS, f"{job_id}:{seq:012d}", event)
        return event


__all__ = ["JobRepository"]
