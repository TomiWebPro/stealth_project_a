"""Authoritative asset feed repository.

The feed is derived fresh from the ``ASSETS`` collection — the same store
``AssetRepository`` writes and ``AssetStatsRepository`` reads — so it can never
drift from ``GET /assets``, ``GET /assets/stats`` or from what actually exists.
There is no persisted feed or second index — removing this router leaves no
collection behind.

Project display names are joined from the authoritative ``PROJECTS`` store; an
asset whose project is missing falls back to a stable display name rather than
being dropped. Soft-deleted assets are excluded (matching ``/assets`` and
``/assets/stats``). Ordering is by descending ``(created_at, asset_id)`` so the
newest asset comes first and ties are broken deterministically across the
in-memory and SQLite adapters. ``total`` counts the whole filtered feed before
the ``limit`` page is applied. An unknown ``project_id`` raises ``NotFoundError``
for the shared 404 envelope; bounds are validated at the router (shared 422
envelope).

Mirrors ``frontend/src/types/assetFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.asset import Asset
from ..schemas.asset_feed import AssetFeed, AssetFeedItem
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"


class AssetFeedRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def feed(self, *, project_id: UUID | None = None, limit: int = 50) -> AssetFeed:
        """Build the newest-first asset feed, optionally scoped to a project.

        ``total`` counts every live asset in scope before the ``limit`` page is
        applied. ``items`` holds at most ``limit`` entries in descending
        ``(created_at, asset_id)`` order with a stable id tie-break.
        """
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        assets = [
            asset
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.status != "deleted"
            and (project_id is None or asset.project_id == project_id)
        ]
        assets.sort(key=lambda asset: (asset.created_at, str(asset.id)), reverse=True)

        items = [
            AssetFeedItem(
                asset_id=asset.id,
                project_id=asset.project_id,
                project_name=project_names.get(asset.project_id, _UNKNOWN_PROJECT_NAME),
                type=asset.type,
                name=asset.name,
                status=asset.status,
                version=asset.version,
                size_bytes=asset.storage.size_bytes,
                created_at=asset.created_at,
                updated_at=asset.updated_at,
            )
            for asset in assets
        ]

        return AssetFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["AssetFeedRepository", "_UNKNOWN_PROJECT_NAME"]
