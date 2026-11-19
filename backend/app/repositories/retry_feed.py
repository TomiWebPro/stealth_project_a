"""Authoritative job retry feed repository.

The feed is derived fresh from the ``JOB_RETRIES`` collection — the same
idempotency ledger ``JobRepository.retry`` writes and ``RetryStatsRepository``
aggregates — joined to ``JOBS`` for job identity/lifecycle and ``PROJECTS`` for
display names. There is no persisted feed or second index; removing this router
leaves no collection behind.

The ledger records one entry per accepted retry (keyed by job id + idempotency
key) but carries no timestamp, so a job is projected once with its total accepted
retry count. Its recency signal is the joined job's latest activity timestamp
(created/started/finished) — identical to ``RetryStatsRepository.newest_retry_at``
so the feed and the snapshot cannot disagree. Ledger entries for missing or
malformed jobs (orphans) are excluded. Ordering is by descending
``(retried_at, job_id)`` for a deterministic cross-backend order; ``total``
counts the whole filtered feed before the ``limit`` page is applied. An unknown
``project_id`` raises ``NotFoundError`` so the shared 404 envelope is used;
bounds are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/retryFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.operation import Job
from ..schemas.retry_feed import RetryFeed, RetryFeedItem
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"


class RetryFeedRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def feed(
        self,
        *,
        project_id: UUID | None = None,
        limit: int = 50,
    ) -> RetryFeed:
        """Build the newest-first retried-job feed, optionally scoped to a project.

        An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
        envelope is used (same behaviour as the other project-scoped routers).
        ``total`` counts every retried job in scope before the ``limit`` page is
        applied.
        """
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        jobs: dict[UUID, Job] = {}
        for doc in self.store.all(Collections.JOBS):
            try:
                job = Job.model_validate(doc)
            except (KeyError, TypeError, ValueError):
                # A malformed/partial job document cannot be attributed.
                continue
            jobs[job.id] = job

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        retry_counts: dict[UUID, int] = {}
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

        items: list[RetryFeedItem] = []
        for job_id, count in retry_counts.items():
            job = jobs[job_id]
            # The ledger is timestamp-free, so the joined job's latest activity
            # is the most accurate available recency signal for its retries.
            retried_at = max(
                value
                for value in (job.created_at, job.started_at, job.finished_at)
                if value is not None
            )
            items.append(
                RetryFeedItem(
                    job_id=job.id,
                    project_id=job.project_id,
                    project_name=project_names.get(job.project_id, _UNKNOWN_PROJECT_NAME),
                    operation_id=job.operation_id,
                    status=job.status,
                    attempt=job.attempt,
                    retries=count,
                    retried_at=retried_at,
                )
            )

        # (retried_at, job_id) gives a deterministic newest-first order across
        # both storage adapters; job_id is the stable tie-break.
        items.sort(key=lambda item: (item.retried_at, str(item.job_id)), reverse=True)

        return RetryFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["RetryFeedRepository", "_UNKNOWN_PROJECT_NAME"]
