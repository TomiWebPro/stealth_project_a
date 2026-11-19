"""Authoritative job feed repository.

The feed is derived fresh from the ``JOBS`` collection — the same store
``JobRepository`` writes, ``JobStatsRepository`` aggregates and
``JobQueueRepository`` filters for active jobs — so it can never drift from
``GET /jobs``, ``GET /jobs/stats`` or from what actually exists. There is no
persisted feed or second index — removing this router leaves no collection
behind.

Project display names are joined from the authoritative ``PROJECTS`` store; a
job whose project is missing falls back to a stable display name rather than
being dropped. Ordering is by descending ``(created_at, job_id)`` so the newest
job comes first and ties are broken deterministically across the in-memory and
SQLite adapters. ``total`` counts the whole filtered feed before the ``limit``
page is applied. An unknown ``project_id`` raises ``NotFoundError`` for the
shared 404 envelope; bounds are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/jobFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.job_feed import JobFeed, JobFeedItem
from ..schemas.operation import Job, JobStatus
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"


class JobFeedRepository(BaseRepository):
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
        status: JobStatus | None = None,
        limit: int = 50,
    ) -> JobFeed:
        """Build the newest-first job feed, optionally scoped to a project/status.

        ``total`` counts every job in scope before the ``limit`` page is applied.
        ``items`` holds at most ``limit`` entries in descending
        ``(created_at, job_id)`` order with a stable id tie-break.
        """
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        jobs = [
            job
            for job in self._load_all(Collections.JOBS, Job)
            if (project_id is None or job.project_id == project_id)
            and (status is None or job.status == status)
        ]
        jobs.sort(key=lambda job: (job.created_at, str(job.id)), reverse=True)

        items = [
            JobFeedItem(
                job_id=job.id,
                project_id=job.project_id,
                project_name=project_names.get(job.project_id, _UNKNOWN_PROJECT_NAME),
                operation_id=job.operation_id,
                status=job.status,
                progress=job.progress,
                attempt=job.attempt,
                created_by=job.created_by,
                created_at=job.created_at,
                started_at=job.started_at,
                finished_at=job.finished_at,
            )
            for job in jobs
        ]

        return JobFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["JobFeedRepository", "_UNKNOWN_PROJECT_NAME"]
