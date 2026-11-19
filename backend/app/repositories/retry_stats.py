"""Authoritative job retry statistics repository.

Retry statistics are derived directly from the ``JOB_RETRIES`` collection — the
same authoritative idempotency ledger ``JobRepository.retry`` writes on every
accepted retry — joined to ``JOBS`` for project attribution and job status. The
snapshot can never drift from the retries actually recorded. There is no second
index and removing the router leaves no collection behind.

``by_status`` is zero-filled over the canonical ``JobStatus`` values in their
documented order and ``by_project`` is sorted by descending retry count then
project id, so the wire shape is byte-for-byte identical across the in-memory
and SQLite stores. Ledger entries whose job no longer exists (orphans) cannot
be attributed and are excluded from every view, keeping the totals consistent
with the per-project breakdown. An unknown ``project_id`` raises
``NotFoundError`` so the shared 404 envelope is used, matching the other
project-scoped routers.

Mirrors ``frontend/src/types/retryStats.ts`` contracts.
"""

from __future__ import annotations

from typing import get_args
from uuid import UUID

from ..schemas.common import utcnow
from ..schemas.operation import Job, JobStatus
from ..schemas.retry_stats import RetryProjectCount, RetryStats, RetryStatusCount
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_STATUSES = tuple(get_args(JobStatus))


class RetryStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> RetryStats:
        """Build fresh job-retry metrics, optionally scoped to a project."""
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        jobs: dict[UUID, Job] = {}
        for doc in self.store.all(Collections.JOBS):
            try:
                job = Job.model_validate(doc)
            except (KeyError, TypeError, ValueError):
                # A malformed/partial job document cannot attribute retries.
                continue
            jobs[job.id] = job

        retry_counts: dict[UUID, int] = {}
        retried_jobs: dict[UUID, Job] = {}
        for doc in self.store.all(Collections.JOB_RETRIES):
            try:
                job_id = UUID(str(doc["job_id"]))
            except (KeyError, TypeError, ValueError):
                continue
            job = jobs.get(job_id)
            if job is None:
                # Orphaned ledger entry: no job to attribute it to.
                continue
            if project_id is not None and job.project_id != project_id:
                continue
            retry_counts[job_id] = retry_counts.get(job_id, 0) + 1
            retried_jobs[job_id] = job

        status_counts: dict[str, int] = {status: 0 for status in _STATUSES}
        per_project: dict[UUID, list[int]] = {}
        newest = None
        for job_id, job in retried_jobs.items():
            status_counts[job.status] = status_counts.get(job.status, 0) + 1
            bucket = per_project.setdefault(job.project_id, [0, 0])
            bucket[0] += retry_counts[job_id]
            bucket[1] += 1
            # The ledger is timestamp-free: use the joined job's latest activity
            # as the recency signal for when it was retried.
            for candidate in (job.created_at, job.started_at, job.finished_at):
                if candidate is not None and (newest is None or candidate > newest):
                    newest = candidate

        by_status = [
            RetryStatusCount(status=status, jobs=status_counts.get(status, 0))
            for status in _STATUSES
        ]
        by_project = [
            RetryProjectCount(project_id=pid, retries=values[0], jobs=values[1])
            for pid, values in per_project.items()
        ]
        by_project.sort(key=lambda entry: (-entry.retries, str(entry.project_id)))

        return RetryStats(
            total_retries=sum(retry_counts.values()),
            total_jobs=len(retried_jobs),
            by_status=by_status,
            by_project=by_project,
            newest_retry_at=newest,
            generated_at=self.clock(),
        )


__all__ = ["RetryStatsRepository"]
