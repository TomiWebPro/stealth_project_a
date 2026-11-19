"""Authoritative asset version statistics repository.

Statistics are derived directly from the ``ASSET_VERSIONS`` collection — the
same authoritative store ``AssetRepository`` writes on register and on every
``create_version`` call — so the snapshot can never drift from what actually
exists. There is no second index and removing the router leaves no collection
behind.

A version record carries no project id or lifecycle status, so it is attributed
to the project of its asset. Records whose asset is soft-deleted or unknown are
excluded (matching ``AssetStatsRepository`` and ``LineageStatsRepository``),
keeping the totals consistent with the per-project breakdown. ``by_version`` is
ordered by ascending version number and ``by_project`` by descending version
count then project id, giving byte-for-byte identical wire shapes across the
in-memory and SQLite stores. An unknown ``project_id`` raises ``NotFoundError``
so the shared 404 envelope is used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/versionStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from uuid import UUID

from ..schemas.asset import Asset, AssetVersion
from ..schemas.common import utcnow
from ..schemas.version_stats import (
    VersionNumberCount,
    VersionProjectCount,
    VersionStats,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository


class VersionStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> VersionStats:
        """Build fresh version metrics, optionally scoped to a project."""
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        # A version is attributed to the project of its asset. Only live
        # (non-deleted) assets are eligible, as with every other asset-derived
        # metric; a version of a deleted/unknown asset is ignored entirely.
        project_by_asset: dict[UUID, UUID] = {
            asset.id: asset.project_id
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.status != "deleted"
        }

        versions = [
            version
            for version in self._load_all(Collections.ASSET_VERSIONS, AssetVersion)
            if version.asset_id in project_by_asset
        ]
        if project_id is not None:
            versions = [
                version
                for version in versions
                if project_by_asset[version.asset_id] == project_id
            ]

        number_counts: Counter[int] = Counter(v.version for v in versions)
        by_version = [
            VersionNumberCount(version=number, count=number_counts[number])
            for number in sorted(number_counts)
        ]

        asset_ids_by_project: dict[UUID, set[UUID]] = {}
        versions_by_project: Counter[UUID] = Counter()
        for version in versions:
            current_project = project_by_asset[version.asset_id]
            versions_by_project[current_project] += 1
            asset_ids_by_project.setdefault(current_project, set()).add(version.asset_id)
        # Most-versioned projects first; stable project-id tie-break keeps the
        # order identical across the memory and SQLite stores.
        by_project = [
            VersionProjectCount(
                project_id=current_id,
                versions=count,
                assets=len(asset_ids_by_project[current_id]),
            )
            for current_id, count in sorted(
                versions_by_project.items(), key=lambda item: (-item[1], str(item[0]))
            )
        ]

        newest = max(
            versions,
            key=lambda version: (version.created_at, str(version.asset_id)),
            default=None,
        )

        return VersionStats(
            total_versions=len(versions),
            total_assets=len({v.asset_id for v in versions}),
            revisions=sum(1 for v in versions if v.version >= 2),
            by_version=by_version,
            by_project=by_project,
            newest_version_at=newest.created_at if newest is not None else None,
            generated_at=self.clock(),
        )


__all__ = ["VersionStatsRepository"]
