"""Authoritative job event stream statistics repository.

Event statistics are derived directly from the ``JOB_EVENTS`` collection — the
same authoritative store ``JobRepository`` writes on every job transition — so
the snapshot can never drift from the events actually emitted. There is no
second index and removing the router leaves no collection behind.

``by_type`` is zero-filled over the canonical ``JobEventType`` values in their
documented order and ``by_job`` is sorted by descending event count then job id,
so the wire shape is byte-for-byte identical across the in-memory and SQLite
stores. An optional ``project_id`` scope joins events to their parent jobs for
project attribution (events from unknown/deleted jobs are skipped); an unknown
project raises ``NotFoundError`` so the shared 404 envelope is used, matching
the other project-scoped routers.

Mirrors ``frontend/src/types/eventStats.ts`` contracts.
"""

from __future__ import annotations

from typing import get_args
from uuid import UUID

from ..schemas.common import utcnow
from ..schemas.event_stats import EventJobCount, EventStats, EventTypeCount
from ..schemas.operation import JobEvent, JobEventType
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_TYPES = tuple(get_args(JobEventType))


class EventStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> EventStats:
        """Build fresh job-event metrics, optionally scoped to a project."""
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        events = self._load_all(Collections.JOB_EVENTS, JobEvent)

        if project_id is not None:
            # Join events to jobs so a project scope attributes an event only
            # when its parent job still exists and belongs to that project.
            job_projects: dict[UUID, UUID] = {}
            for doc in self.store.all(Collections.JOBS):
                try:
                    job_projects[UUID(str(doc["id"]))] = UUID(str(doc["project_id"]))
                except (KeyError, TypeError, ValueError):
                    # A malformed/partial job document cannot attribute events.
                    continue
            events = [event for event in events if job_projects.get(event.job_id) == project_id]

        type_counts = {event_type: 0 for event_type in _TYPES}
        per_job: dict[UUID, list] = {}
        for event in events:
            type_counts[event.type] = type_counts.get(event.type, 0) + 1
            bucket = per_job.setdefault(event.job_id, [0, event.timestamp])
            bucket[0] += 1
            if event.timestamp > bucket[1]:
                bucket[1] = event.timestamp

        by_type = [
            EventTypeCount(type=event_type, count=type_counts.get(event_type, 0))
            for event_type in _TYPES
        ]
        by_job = [
            EventJobCount(
                job_id=job_id,
                events=values[0],
                newest_event_at=values[1],
            )
            for job_id, values in per_job.items()
        ]
        by_job.sort(key=lambda entry: (-entry.events, str(entry.job_id)))

        newest = max((event.timestamp for event in events), default=None)

        return EventStats(
            total_events=len(events),
            total_jobs=len(per_job),
            by_type=by_type,
            by_job=by_job,
            newest_event_at=newest,
            generated_at=self.clock(),
        )


__all__ = ["EventStatsRepository"]
