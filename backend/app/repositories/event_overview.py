"""Authoritative single job-event overview repository.

The snapshot is derived fresh from the authoritative job/event/project stores on
every call, like ``MessageOverviewRepository`` and ``EventStatsRepository``: there
is no second index to drift and removing the router leaves no collection behind.
The ``by_type`` breakdown reuses the same canonical values and count type as
``/events/stats`` and the project-name fallback reuses the rule from
``/events/feed``, so the overview cannot disagree with them.

Only events from the requested job contribute to the counts and the sibling page;
an event sequence belonging to another job is never mistaken for one in this job.
The sibling page is newest-first with a deterministic ``(timestamp, seq)``
tie-break across both storage adapters, while ``counts`` describe the whole job
and are never bounded by ``recent_limit``.

An unknown job raises ``NotFoundError`` for the shared 404 ``job_not_found``
envelope; a sequence absent from that job raises the shared 404
``event_not_found`` envelope. Bounds/sequence validation happens at the router
(shared 422 envelope).

Mirrors ``frontend/src/types/eventOverview.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from uuid import UUID

from ..errors import NotFoundError
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.event_overview import EventOverview, EventOverviewCounts
from ..schemas.event_stats import EventTypeCount
from ..schemas.operation import JobEvent
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .event_feed import _UNKNOWN_PROJECT_NAME
from .event_stats import _TYPES
from .jobs import JobRepository


class EventOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        jobs: JobRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.jobs = jobs

    def overview(self, job_id: UUID, seq: int, *, recent_limit: int = 5) -> EventOverview:
        """Build a fresh snapshot for one event, newest sibling first."""
        job = self.jobs.get_or_raise(job_id)

        project = self._load(Collections.PROJECTS, str(job.project_id), Project)
        project_name = project.name if project is not None else _UNKNOWN_PROJECT_NAME

        events = [
            event
            for event in self._load_all(Collections.JOB_EVENTS, JobEvent)
            if event.job_id == job_id
        ]
        target = next((event for event in events if event.seq == seq), None)
        if target is None:
            raise NotFoundError("event", str(seq), code="event_not_found")

        type_counts: Counter[str] = Counter(event.type for event in events)
        counts = EventOverviewCounts(
            total=len(events),
            by_type=[
                EventTypeCount(type=event_type, count=type_counts.get(event_type, 0))
                for event_type in _TYPES
            ],
        )

        newest_first = sorted(
            events,
            key=lambda event: (event.timestamp, event.seq),
            reverse=True,
        )
        return EventOverview(
            job_id=job.id,
            seq=target.seq,
            type=target.type,
            operation_id=job.operation_id,
            project_id=job.project_id,
            project_name=project_name,
            status=target.status,
            progress=target.progress,
            message=target.message,
            asset_id=target.asset_id,
            error=target.error,
            timestamp=target.timestamp,
            counts=counts,
            recent_siblings=newest_first[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["EventOverviewRepository"]
