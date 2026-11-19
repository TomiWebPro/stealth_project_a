"""Authoritative upload statistics repository.

Upload statistics are derived directly from the ``UPLOADS`` collection — the
same authoritative store ``UploadRepository`` writes on ticket create/complete —
so the snapshot can never drift from what actually exists. There is no second
index and removing the router leaves no collection behind.

``by_status`` is zero-filled over the canonical ``UploadStatus`` values in their
documented order and ``by_project`` is sorted by descending ticket count then
project id, so the wire shape is byte-for-byte identical across the in-memory
and SQLite stores. An unknown ``project_id`` raises ``NotFoundError`` so the
shared 404 envelope is used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/uploadStats.ts`` contracts.
"""

from __future__ import annotations

from typing import get_args
from uuid import UUID

from ..schemas.common import utcnow
from ..schemas.upload_stats import (
    UploadProjectCount,
    UploadStats,
    UploadStatus,
    UploadStatusCount,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository
from .uploads import UploadRecord

_STATUSES = tuple(get_args(UploadStatus))


class UploadStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> UploadStats:
        """Build fresh upload-ticket metrics, optionally scoped to a project."""
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        records = [
            record
            for record in self._load_all(Collections.UPLOADS, UploadRecord)
            if project_id is None or record.project_id == project_id
        ]

        pending = sum(1 for record in records if record.status == "pending")
        completed = sum(1 for record in records if record.status == "complete")
        bytes_uploaded = sum(
            record.size_bytes for record in records if record.status == "complete"
        )
        status_counts = {"pending": pending, "complete": completed}
        by_status = [
            UploadStatusCount(status=status, count=status_counts.get(status, 0))
            for status in _STATUSES
        ]

        project_totals: dict[UUID, list[int]] = {}
        for record in records:
            bucket = project_totals.setdefault(record.project_id, [0, 0, 0])
            bucket[0] += 1
            if record.status == "complete":
                bucket[1] += 1
                bucket[2] += record.size_bytes
        by_project = [
            UploadProjectCount(
                project_id=project,
                total=totals[0],
                completed=totals[1],
                bytes_uploaded=totals[2],
            )
            for project, totals in project_totals.items()
        ]
        by_project.sort(key=lambda entry: (-entry.total, str(entry.project_id)))

        newest = max((record.created_at for record in records), default=None)

        return UploadStats(
            total_tickets=len(records),
            pending=pending,
            completed=completed,
            bytes_uploaded=bytes_uploaded,
            by_status=by_status,
            by_project=by_project,
            newest_upload_at=newest,
            generated_at=self.clock(),
        )


__all__ = ["UploadStatsRepository"]
