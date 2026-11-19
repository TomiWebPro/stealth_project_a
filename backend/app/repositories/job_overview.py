"""Authoritative single-job overview repository.

The snapshot is derived fresh from the authoritative stores on every call, like
``ProjectOverviewRepository``, ``AssetOverviewRepository`` and
``ConversationOverviewRepository``: there is no second index to drift and
removing the router leaves no collection behind. The ``by_event_type`` buckets
reuse the canonical ``JobEventType`` values and ``EventTypeCount`` type from
``/events/stats``, so the overview cannot disagree with that aggregate.

An unknown job raises ``NotFoundError`` for the shared 404 ``job_not_found``
envelope; the ``recent_limit`` bound is validated at the router (shared 422
envelope).

Mirrors ``frontend/src/types/jobOverview.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.event_stats import EventTypeCount
from ..schemas.job_overview import JobOverview, JobOverviewCounts
from ..schemas.operation import Job, JobEvent, JobEventType
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .job_feed import _UNKNOWN_PROJECT_NAME
from .jobs import JobRepository

_EVENT_TYPES = tuple(get_args(JobEventType))


class JobOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        jobs: JobRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.jobs = jobs

    def overview(self, job_id: UUID, *, recent_limit: int = 5) -> JobOverview:
        """Build a fresh snapshot for one job, newest event first."""
        job = self.jobs.get_or_raise(job_id)

        project = self._load(Collections.PROJECTS, str(job.project_id), Project)
        project_name = project.name if project is not None else _UNKNOWN_PROJECT_NAME

        events = [
            event
            for event in self._load_all(Collections.JOB_EVENTS, JobEvent)
            if event.job_id == job_id
        ]
        # Matches the event-feed ` (timestamp, job_id, seq)` newest-first rule;
        # job_id is constant here but kept for an identical ordering contract.
        events.sort(
            key=lambda event: (event.timestamp, str(event.job_id), event.seq),
            reverse=True,
        )

        type_counts: Counter[str] = Counter(event.type for event in events)
        retries = 0
        for doc in self.store.all(Collections.JOB_RETRIES):
            try:
                if UUID(str(doc["job_id"])) == job_id:
                    retries += 1
            except (KeyError, TypeError, ValueError):
                # A malformed ledger entry cannot be attributed to this job.
                continue

        counts = JobOverviewCounts(
            events=len(events),
            retries=retries,
            by_event_type=[
                EventTypeCount(type=event_type, count=type_counts.get(event_type, 0))
                for event_type in _EVENT_TYPES
            ],
        )

        return JobOverview(
            job_id=job.id,
            project_id=job.project_id,
            project_name=project_name,
            operation_id=job.operation_id,
            schema_version=job.schema_version,
            status=job.status,
            progress=job.progress,
            attempt=job.attempt,
            created_by=job.created_by,
            created_at=job.created_at,
            started_at=job.started_at,
            finished_at=job.finished_at,
            result=job.result,
            error=job.error,
            counts=counts,
            recent_events=events[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["JobOverviewRepository"]
