"""Authoritative single-version overview repository.

The snapshot is derived fresh from the authoritative ``ASSET_VERSIONS``/``ASSETS``
stores on every call, like ``AssetOverviewRepository``: there is no second index
to drift and removing the router leaves no collection behind. ``counts`` uses the
same version-number semantics as ``VersionStatsRepository`` (a version record of
2 or higher is a revision) and ``recent_versions`` reuses the version records of
the parent asset, so the single-version view cannot disagree with
``/versions/stats`` or ``/versions/feed``. Project display names are joined from
the authoritative ``PROJECTS`` store with a stable fallback.

An unknown asset uses the shared 404 ``asset_not_found`` envelope (via the asset
repository); a version that does not exist for that asset raises ``NotFoundError``
for the shared 404 ``version_not_found`` envelope. The ``version`` path bound and
``recent_limit`` query bound are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/versionOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..errors import NotFoundError
from ..schemas.asset import AssetVersion
from ..schemas.common import utcnow
from ..schemas.version_overview import VersionOverview, VersionOverviewCounts
from ..storage.base import Collections, DocumentStore
from .assets import AssetRepository
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"


class VersionOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        assets: AssetRepository,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.assets = assets
        self.projects = projects

    def overview(
        self, asset_id: UUID, version: int, *, recent_limit: int = 5
    ) -> VersionOverview:
        """Build a fresh snapshot for one version of one asset."""
        asset = self.assets.get_or_raise(asset_id)

        versions = [
            record
            for record in self._load_all(Collections.ASSET_VERSIONS, AssetVersion)
            if record.asset_id == asset_id
        ]
        target = next((record for record in versions if record.version == version), None)
        if target is None:
            raise NotFoundError("version", str(version), code="version_not_found")

        project = self.projects.get(asset.project_id)
        project_name = project.name if project is not None else _UNKNOWN_PROJECT_NAME

        counts = VersionOverviewCounts(
            asset_versions=len(versions),
            revisions=sum(1 for record in versions if record.version >= 2),
        )

        # Newest-version-first with deterministic tie-breaks so the page agrees
        # with the ordering used by the asset-overview and version-feed views.
        recent = sorted(
            versions,
            key=lambda record: (record.version, record.created_at, str(record.asset_id)),
            reverse=True,
        )[:recent_limit]

        return VersionOverview(
            asset_id=asset.id,
            asset_name=asset.name,
            asset_type=asset.type,
            project_id=asset.project_id,
            project_name=project_name,
            version=target.version,
            storage=target.storage,
            created_by=target.created_by,
            created_at=target.created_at,
            is_latest=target.version == asset.version,
            counts=counts,
            recent_versions=recent,
            generated_at=self.clock(),
        )


__all__ = ["VersionOverviewRepository", "_UNKNOWN_PROJECT_NAME"]
