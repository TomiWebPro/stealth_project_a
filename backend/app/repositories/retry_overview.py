"""Authoritative single-retry overview repository.

The snapshot is derived fresh from the authoritative ``JOB_RETRIES`` collection —
the same idempotency ledger ``JobRepository.retry`` writes, ``RetryStatsRepository``
aggregates and ``RetryFeedRepository`` projects — joined to ``JOBS`` for job
identity/lifecycle and ``PROJECTS`` for display names. There is no persisted
overview or second index; removing the router leaves no collection behind.

The sibling wire shape reuses ``RetryFeedItem`` and the recency signal (the
joined job's latest created/started/finished timestamp) is identical to both
``/retries/feed`` and ``/retries/stats``, so the overview cannot disagree with
those views. Ledger entries for missing or malformed jobs (orphans) are excluded
everywhere. Siblings are scoped to the target job's project and ordered newest
first with a deterministic ``(retried_at, job_id)`` tie-break across both storage
adapters, while ``counts`` describe whole scopes and are never bounded by the
``recent_limit`` page.

An unknown job raises ``NotFoundError`` for the shared 404 ``job_not_found``
envelope; a job with no accepted retries raises the shared 404 ``retry_not_found``
envelope. Bounds validation happens at the router (shared 422 envelope).

Mirrors ``frontend/src/types/retryOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..errors import NotFoundError
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.operation import Job
from ..schemas.retry_feed import RetryFeedItem
from ..schemas.retry_overview import RetryOverview, RetryOverviewCounts
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .jobs import JobRepository
from .retry_feed import _UNKNOWN_PROJECT_NAME


class RetryOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        jobs: JobRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.jobs = jobs

    def overview(self, job_id: UUID, *, recent_limit: int = 5) -> RetryOverview:
        """Build a fresh snapshot for one retried job, newest sibling first."""
        target = self.jobs.get_or_raise(job_id)

        jobs: dict[UUID, Job] = {}
        for doc in self.store.all(Collections.JOBS):
            try:
                job = Job.model_validate(doc)
            except (KeyError, TypeError, ValueError):
                # A malformed/partial job document cannot be attributed.
                continue
            jobs[job.id] = job

        project_names: dict[UUID, str] = {}
        for doc in self.store.all(Collections.PROJECTS):
            try:
                project = Project.model_validate(doc)
            except (KeyError, TypeError, ValueError):
                continue
            project_names[project.id] = project.name

        # One row per retried job with its accepted-retry count; orphan ledger
        # entries (missing/malformed job) are excluded, matching the feed/stats.
        retry_counts: dict[UUID, int] = {}
        for doc in self.store.all(Collections.JOB_RETRIES):
            try:
                retried_id = UUID(str(doc["job_id"]))
            except (KeyError, TypeError, ValueError):
                continue
            if retried_id not in jobs:
                continue
            retry_counts[retried_id] = retry_counts.get(retried_id, 0) + 1

        if job_id not in retry_counts:
            raise NotFoundError("retry", str(job_id), code="retry_not_found")

        items: list[RetryFeedItem] = []
        for retried_id, count in retry_counts.items():
            job = jobs[retried_id]
            # The ledger is timestamp-free: the joined job's latest activity is
            # the recency signal used by both /retries/feed and /retries/stats.
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

        siblings = [item for item in items if item.project_id == target.project_id]
        siblings.sort(key=lambda item: (item.retried_at, str(item.job_id)), reverse=True)

        counts = RetryOverviewCounts(
            project_retries=sum(item.retries for item in siblings),
            project_jobs=len(siblings),
            total_retries=sum(item.retries for item in items),
        )

        return RetryOverview(
            job_id=target.id,
            project_id=target.project_id,
            project_name=project_names.get(target.project_id, _UNKNOWN_PROJECT_NAME),
            operation_id=target.operation_id,
            status=target.status,
            attempt=target.attempt,
            retries=retry_counts[job_id],
            retried_at=max(
                value
                for value in (target.created_at, target.started_at, target.finished_at)
                if value is not None
            ),
            counts=counts,
            recent_siblings=siblings[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["RetryOverviewRepository"]
