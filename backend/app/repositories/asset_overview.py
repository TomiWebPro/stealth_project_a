"""Authoritative single-asset overview repository.

The snapshot is derived fresh from the authoritative stores on every call, like
``ProjectOverviewRepository``: there is no second index to drift and removing the
router leaves no collection behind. Upstream/downstream counts reuse the same
lineage relationship set as ``/assets/{id}/lineage`` and ``/assets/{id}/impact``,
and ``published`` reuses the ``/publishes/stats`` receipt parser, so the overview
cannot disagree with those endpoints. Soft-deleted/unknown related assets are
excluded from the counts, matching the resource routers.

An unknown asset raises ``NotFoundError`` for the shared 404 envelope; the
``recent_limit`` bound is validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/assetOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.asset import Asset, AssetRelationship, AssetVersion
from ..schemas.asset_overview import AssetOverview, AssetOverviewCounts
from ..schemas.common import utcnow
from ..schemas.orchestration import Comment
from ..storage.base import Collections, DocumentStore
from .assets import LINEAGE_RELATIONSHIPS, AssetRepository
from .base import BaseRepository
from .projects import ProjectRepository
from .publish_stats import _parse_receipt


class AssetOverviewRepository(BaseRepository):
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

    def overview(self, asset_id: UUID, *, recent_limit: int = 5) -> AssetOverview:
        """Build a fresh snapshot for one asset, newest version first."""
        asset = self.assets.get_or_raise(asset_id)

        project = self.projects.get(asset.project_id)
        project_name = project.name if project is not None else "Unknown project"

        versions = [
            version
            for version in self._load_all(Collections.ASSET_VERSIONS, AssetVersion)
            if version.asset_id == asset_id
        ]
        versions.sort(
            key=lambda version: (version.version, version.created_at, str(version.asset_id)),
            reverse=True,
        )

        # Only live assets participate as related endpoints (matching impact,
        # which excludes soft-deleted descendants, and the live asset set).
        live_ids = {
            other.id
            for other in self._load_all(Collections.ASSETS, Asset)
            if other.status != "deleted"
        }
        upstream_ids: set[UUID] = set()
        downstream_ids: set[UUID] = set()
        for relationship in self._load_all(
            Collections.ASSET_RELATIONSHIPS, AssetRelationship
        ):
            if relationship.type not in LINEAGE_RELATIONSHIPS:
                continue
            if (
                relationship.from_asset_id == asset_id
                and relationship.to_asset_id in live_ids
                and relationship.to_asset_id != asset_id
            ):
                upstream_ids.add(relationship.to_asset_id)
            if (
                relationship.to_asset_id == asset_id
                and relationship.from_asset_id in live_ids
                and relationship.from_asset_id != asset_id
            ):
                downstream_ids.add(relationship.from_asset_id)

        comment_count = sum(
            1
            for comment in self._load_all(Collections.COMMENTS, Comment)
            if comment.asset_id == asset_id
        )

        counts = AssetOverviewCounts(
            versions=len(versions),
            upstream=len(upstream_ids),
            downstream=len(downstream_ids),
            comments=comment_count,
            tags=len(asset.tags),
        )
        # Reuse the publish-stats receipt parser so the flag can never drift from
        # GET /publishes/stats for this asset.
        published = _parse_receipt(asset.metadata.get("publish_receipt")) is not None

        return AssetOverview(
            asset_id=asset.id,
            asset_name=asset.name,
            asset_type=asset.type,
            status=asset.status,
            version=asset.version,
            project_id=asset.project_id,
            project_name=project_name,
            created_at=asset.created_at,
            published=published,
            counts=counts,
            recent_versions=versions[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["AssetOverviewRepository"]
