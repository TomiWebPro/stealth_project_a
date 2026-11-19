"""Authoritative upload-ticket feed repository.

The feed is derived fresh from the ``UPLOADS`` collection — the same store
``UploadRepository`` writes on ticket create/complete and ``UploadStatsRepository``
reads for its snapshot — so it can never drift from ``GET /uploads/stats`` or from
what actually exists. There is no persisted feed or second index — removing this
router leaves no collection behind.

Project display names are joined from the authoritative ``PROJECTS`` store; a
ticket whose project is missing falls back to a stable display name rather than
being dropped. Ordering is by descending ``(created_at, upload_id)`` so the newest
ticket comes first and ties are broken deterministically across the in-memory and
SQLite adapters. ``total`` counts the whole filtered feed before the ``limit`` page
is applied. An unknown ``project_id`` raises ``NotFoundError`` for the shared 404
envelope; bounds are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/uploadFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.upload_feed import UploadFeed, UploadFeedItem
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository
from .uploads import UploadRecord

_UNKNOWN_PROJECT_NAME = "Unknown project"


class UploadFeedRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def feed(self, *, project_id: UUID | None = None, limit: int = 50) -> UploadFeed:
        """Build the newest-first upload feed, optionally scoped to one project.

        ``total`` counts every upload ticket in scope before the ``limit`` page is
        applied. ``items`` holds at most ``limit`` entries in descending creation
        time order with a stable upload-id tie-break.
        """
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        items: list[UploadFeedItem] = []
        for record in self._load_all(Collections.UPLOADS, UploadRecord):
            if project_id is not None and record.project_id != project_id:
                continue
            items.append(
                UploadFeedItem(
                    upload_id=record.upload_id,
                    project_id=record.project_id,
                    project_name=project_names.get(record.project_id, _UNKNOWN_PROJECT_NAME),
                    filename=record.filename,
                    content_type=record.content_type,
                    status=record.status,
                    declared_size=record.declared_size,
                    size_bytes=record.size_bytes,
                    created_at=record.created_at,
                    expires_at=record.expires_at,
                )
            )

        items.sort(key=lambda item: (item.created_at, str(item.upload_id)), reverse=True)

        return UploadFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["UploadFeedRepository", "_UNKNOWN_PROJECT_NAME"]
