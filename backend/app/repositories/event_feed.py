"""Authoritative job event feed repository.

The feed is derived fresh from the ``JOB_EVENTS`` collection — the same store the
SSE/polling endpoints read and event statistics aggregates — so it can never
drift from ``GET /jobs/{id}/events`` or ``GET /events/stats``. There is no
persisted feed or second index — removing this router leaves no collection
behind.

Each event is joined to its parent job from the authoritative ``JOBS`` store to
supply operation/project identity, and project display names are joined from the
authoritative ``PROJECTS`` store with a stable fallback. Events whose job is
missing cannot be attributed and are skipped (the same orphan rule the
project-scoped event statistics derivation uses); a missing project keeps the
event with an "Unknown project" name. Ordering is descending
``(timestamp, job_id, seq)`` so the newest event comes first and ties break
deterministically across the in-memory and SQLite adapters. ``total`` counts the
whole filtered feed before the ``limit`` page is applied. An optional
``project_id`` scope validates the project first so an unknown id uses the shared
404 envelope; bounds/type validation happens at the router (shared 422 envelope).

Mirrors ``frontend/src/types/eventFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.event_feed import EventFeed, EventFeedItem
from ..schemas.operation import JobEvent, JobEventType
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"


class EventFeedRepository(BaseRepository):
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
        type: JobEventType | None = None,
        limit: int = 50,
    ) -> EventFeed:
        """Build the newest-first job event feed, optionally filtered.

        An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
        envelope is used (same behaviour as the other project-scoped routers).
        ``total`` counts every event in scope before the ``limit`` page is
        applied.
        """
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        # Join events to jobs for operation/project attribution. A malformed or
        # partial job document cannot attribute its events, so it is skipped.
        job_meta: dict[UUID, tuple[str, UUID]] = {}
        for doc in self.store.all(Collections.JOBS):
            try:
                job_id = UUID(str(doc["id"]))
                job_meta[job_id] = (str(doc["operation_id"]), UUID(str(doc["project_id"])))
            except (KeyError, TypeError, ValueError):
                continue

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        items: list[EventFeedItem] = []
        for event in self._load_all(Collections.JOB_EVENTS, JobEvent):
            meta = job_meta.get(event.job_id)
            if meta is None:
                # Orphan event: without its job there is no operation or project
                # identity to project, so it cannot appear in the feed.
                continue
            operation_id, event_project_id = meta
            if project_id is not None and event_project_id != project_id:
                continue
            if type is not None and event.type != type:
                continue
            items.append(
                EventFeedItem(
                    job_id=event.job_id,
                    seq=event.seq,
                    type=event.type,
                    operation_id=operation_id,
                    project_id=event_project_id,
                    project_name=project_names.get(event_project_id, _UNKNOWN_PROJECT_NAME),
                    status=event.status,
                    progress=event.progress,
                    message=event.message,
                    asset_id=event.asset_id,
                    error=event.error,
                    timestamp=event.timestamp,
                )
            )

        items.sort(
            key=lambda item: (item.timestamp, str(item.job_id), item.seq),
            reverse=True,
        )

        return EventFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["EventFeedRepository", "_UNKNOWN_PROJECT_NAME"]
