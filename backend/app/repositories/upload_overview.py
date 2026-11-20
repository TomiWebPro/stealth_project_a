"""Authoritative single-upload-ticket overview repository.

The snapshot is derived fresh from the ``UPLOADS`` collection — the same store
``UploadRepository`` writes on ticket create/complete, ``UploadFeedRepository``
reads for the feed and ``UploadStatsRepository`` aggregates — with the project
display name joined from the authoritative project store. There is no second
index to drift and removing the router leaves no collection behind.

The ``counts`` block reuses the exact per-project aggregation behind
``/uploads/stats`` (ticket total, completed tickets and completed bytes), so the
single ticket view cannot disagree with that snapshot. ``bytes_remaining`` and
``progress`` are pure derivations of the authoritative byte fields, and ``expired``
uses the injected clock, keeping the wire shape deterministic across both storage
adapters. An unknown upload raises ``NotFoundError`` for the shared 404
``upload_not_found`` envelope.

Mirrors ``frontend/src/types/uploadOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..errors import NotFoundError
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.upload_overview import UploadOverview, UploadOverviewCounts
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository
from .uploads import UploadRecord

_UNKNOWN_PROJECT_NAME = "Unknown project"


class UploadOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def overview(self, upload_id: UUID) -> UploadOverview:
        """Build a fresh snapshot for one upload ticket."""
        records = list(self._load_all(Collections.UPLOADS, UploadRecord))
        record = next(
            (candidate for candidate in records if candidate.upload_id == upload_id),
            None,
        )
        if record is None:
            raise NotFoundError("Upload", str(upload_id), code="upload_not_found")

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        # The same per-project aggregation /uploads/stats emits in its by_project
        # bucket, so the detail view cannot drift from the workspace snapshot.
        project_records = [item for item in records if item.project_id == record.project_id]
        project_completed = [item for item in project_records if item.status == "complete"]
        counts = UploadOverviewCounts(
            project_tickets=len(project_records),
            project_completed=len(project_completed),
            project_bytes_uploaded=sum(item.size_bytes for item in project_completed),
        )

        remaining = max(0, record.declared_size - record.size_bytes)
        progress = (
            min(1.0, record.size_bytes / record.declared_size)
            if record.declared_size > 0
            else 0.0
        )

        return UploadOverview(
            upload_id=record.upload_id,
            project_id=record.project_id,
            project_name=project_names.get(record.project_id, _UNKNOWN_PROJECT_NAME),
            filename=record.filename,
            content_type=record.content_type,
            status=record.status,
            declared_size=record.declared_size,
            size_bytes=record.size_bytes,
            bytes_remaining=remaining,
            progress=progress,
            expired=self.clock() > record.expires_at,
            created_at=record.created_at,
            expires_at=record.expires_at,
            counts=counts,
            generated_at=self.clock(),
        )


__all__ = ["UploadOverviewRepository", "_UNKNOWN_PROJECT_NAME"]
