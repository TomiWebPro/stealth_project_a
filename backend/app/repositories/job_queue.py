"""Authoritative job dispatch-queue repository.

The queue is derived fresh from the authoritative ``JOBS`` collection on every
call — the same store the job lifecycle writes. Only active jobs (``queued``
and ``running``) are included; terminal jobs are excluded. Ordering is FIFO by
``(created_at, job_id)`` ascending, so positions are deterministic and identical
across the in-memory and SQLite adapters (``job_id`` is the stable tie-break for
jobs created in the same instant).

Counters describe the whole filtered queue, not just the returned page, so a
consumer can show queue depth and the next jobs in one call. An unknown
``project_id`` raises ``NotFoundError`` for the shared 404 envelope; bounds are
validated at the router (shared 422 envelope). There is no persisted queue or
second index — removing this router leaves no collection behind.

Mirrors ``frontend/src/types/jobQueue.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.common import utcnow
from ..schemas.job_queue import JobQueueEntry, JobQueueView
from ..schemas.operation import Job
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

# The only lifecycle states that belong to the dispatch queue. Terminal states
# (succeeded / failed / canceled) are deliberately excluded.
_ACTIVE_STATUSES = frozenset({"queued", "running"})


class JobQueueRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def queue(self, *, project_id: UUID | None = None, limit: int = 50) -> JobQueueView:
        """Build the active-job queue, optionally scoped to one project.

        Jobs are ordered FIFO by ``(created_at, job_id)``; ``position`` is the
        1-based index in that full ordering (not in the page). ``total``,
        ``waiting`` and ``running`` count the whole filtered queue before the
        ``limit`` page is applied.
        """
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        active = [
            job
            for job in self._load_all(Collections.JOBS, Job)
            if job.status in _ACTIVE_STATUSES
            and (project_id is None or job.project_id == project_id)
        ]
        active.sort(key=lambda job: (job.created_at, str(job.id)))

        waiting = sum(1 for job in active if job.status == "queued")
        running = sum(1 for job in active if job.status == "running")

        entries = [
            JobQueueEntry(
                position=position,
                job_id=job.id,
                operation_id=job.operation_id,
                status=job.status,  # type: ignore[arg-type]  # queued/running subset of JobStatus
                project_id=job.project_id,
                created_at=job.created_at,
            )
            for position, job in enumerate(active[:limit], start=1)
        ]

        return JobQueueView(
            total=len(active),
            waiting=waiting,
            running=running,
            entries=entries,
            generated_at=self.clock(),
        )


__all__ = ["JobQueueRepository", "_ACTIVE_STATUSES"]
