"""Authoritative asset version-feed repository.

The feed is derived fresh from the ``ASSET_VERSIONS`` collection — the same store
``AssetRepository`` writes on register and on every ``create_version`` call and
``VersionStatsRepository`` aggregates — so it can never drift from the snapshot.
There is no persisted feed or second index; removing this router leaves no
collection behind.

A version record carries no project id or lifecycle status, so it is attributed
to its asset. Versions whose asset is soft-deleted or unknown are excluded
(matching ``VersionStatsRepository`` and every other asset-derived metric),
keeping the feed consistent with the aggregate snapshot. Project display names
are joined from the authoritative ``PROJECTS`` store with a stable fallback.
Ordering is by descending ``(created_at, asset_id, version)`` so the newest
version comes first and ties are broken deterministically across the in-memory
and SQLite adapters. ``total`` counts the whole filtered feed before the
``limit`` page is applied. An optional ``project_id`` scope validates the project
first so an unknown id uses the shared 404 envelope; bounds are validated at the
router (shared 422 envelope).

Mirrors ``frontend/src/types/versionFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.asset import Asset, AssetVersion
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.version_feed import VersionFeed, VersionFeedItem
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"


class VersionFeedRepository(BaseRepository):
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
        limit: int = 50,
    ) -> VersionFeed:
        """Build the newest-first version feed, optionally scoped to a project.

        An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
        envelope is used (same behaviour as the other project-scoped routers).
        ``total`` counts every version record in scope before the ``limit`` page
        is applied.
        """
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        assets_by_id: dict[UUID, Asset] = {
            asset.id: asset
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.status != "deleted"
        }
        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        versions = [
            version
            for version in self._load_all(Collections.ASSET_VERSIONS, AssetVersion)
            if version.asset_id in assets_by_id
            and (
                project_id is None
                or assets_by_id[version.asset_id].project_id == project_id
            )
        ]
        # (created_at, asset_id, version) gives a deterministic newest-first
        # order across both storage adapters; a version record has no id of its
        # own, so asset_id + version are the stable tie-breakers.
        versions.sort(
            key=lambda version: (
                version.created_at,
                str(version.asset_id),
                version.version,
            ),
            reverse=True,
        )

        items = [
            VersionFeedItem(
                asset_id=version.asset_id,
                project_id=assets_by_id[version.asset_id].project_id,
                project_name=project_names.get(
                    assets_by_id[version.asset_id].project_id,
                    _UNKNOWN_PROJECT_NAME,
                ),
                asset_name=assets_by_id[version.asset_id].name,
                asset_type=assets_by_id[version.asset_id].type,
                version=version.version,
                created_by=version.created_by,
                created_at=version.created_at,
            )
            for version in versions
        ]

        return VersionFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["VersionFeedRepository", "_UNKNOWN_PROJECT_NAME"]
