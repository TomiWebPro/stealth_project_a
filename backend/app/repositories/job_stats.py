"""Authoritative job execution statistics repository.

Statistics are derived from the authoritative job store on every call, like
``DashboardRepository`` and ``TagRepository``: there is no second index to drift
and removing the router leaves no collection behind.

``by_status`` is zero-filled over the canonical lifecycle order so the wire shape
is stable across the in-memory and SQLite stores. ``by_operation`` is sorted by
total (then operation id) for the same deterministic-ordering reason. An unknown
``project_id`` raises ``NotFoundError`` so the shared 404 envelope is used,
matching the other project-scoped routers.

Mirrors ``frontend/src/types/jobStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from typing import get_args
from uuid import UUID

from ..errors import NotFoundError
from ..schemas.common import utcnow
from ..schemas.job_stats import JobStats, JobStatusCount, OperationJobStat
from ..schemas.operation import Job, JobStatus
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_STATUSES = tuple(get_args(JobStatus))


class JobStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> JobStats:
        """Build fresh job execution metrics, optionally scoped to a project."""
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        jobs = [
            job
            for job in self._load_all(Collections.JOBS, Job)
            if project_id is None or job.project_id == project_id
        ]

        status_counts: Counter[str] = Counter(job.status for job in jobs)
        by_status = [
            JobStatusCount(status=status, count=status_counts.get(status, 0))
            for status in _STATUSES
        ]

        totals: Counter[str] = Counter()
        succeeded: Counter[str] = Counter()
        failed: Counter[str] = Counter()
        for job in jobs:
            totals[job.operation_id] += 1
            if job.status == "succeeded":
                succeeded[job.operation_id] += 1
            elif job.status == "failed":
                failed[job.operation_id] += 1
        by_operation = [
            OperationJobStat(
                operation_id=operation_id,
                total=count,
                succeeded=succeeded.get(operation_id, 0),
                failed=failed.get(operation_id, 0),
            )
            for operation_id, count in totals.items()
        ]
        # Most jobs first; stable lexical tie-break keeps the order identical
        # across the memory and SQLite stores (whose iteration order may differ).
        by_operation.sort(key=lambda stat: (-stat.total, stat.operation_id))

        successful = status_counts.get("succeeded", 0)
        failures = status_counts.get("failed", 0)
        terminal = successful + failures
        success_rate = round(successful / terminal, 3) if terminal else 0.0

        in_flight = status_counts.get("queued", 0) + status_counts.get("running", 0)
        completed = terminal + status_counts.get("canceled", 0)

        durations: list[float] = []
        for job in jobs:
            duration = _duration_seconds(job)
            if duration is not None:
                durations.append(duration)
        average_duration = round(sum(durations) / len(durations), 3) if durations else None

        return JobStats(
            total=len(jobs),
            by_status=by_status,
            by_operation=by_operation,
            success_rate=success_rate,
            in_flight=in_flight,
            completed=completed,
            average_duration_seconds=average_duration,
            generated_at=self.clock(),
        )


def _duration_seconds(job: Job) -> float | None:
    """Wall-clock seconds for a job with both timing endpoints, else ``None``."""
    start: datetime | None = job.started_at
    finish: datetime | None = job.finished_at
    if start is None or finish is None:
        return None
    return max(0.0, (finish - start).total_seconds())


__all__ = ["JobStatsRepository"]
