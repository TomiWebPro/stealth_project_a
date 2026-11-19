"""Authoritative asset inventory statistics repository.

Statistics are derived from the authoritative asset store on every call, like
``JobStatsRepository`` and ``ConversationStatsRepository``: there is no second
index to drift and removing the router leaves no collection behind.

Soft-deleted assets are excluded from every metric (matching ``/assets``, the
dashboard and the tag index). ``by_type`` and ``by_status`` are zero-filled over
the canonical asset type/status orders so the wire shape is stable across the
in-memory and SQLite stores. An unknown ``project_id`` raises ``NotFoundError``
so the shared 404 envelope is used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/assetStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from ..schemas.asset import Asset, AssetStatus, AssetType
from ..schemas.asset_stats import AssetStats, AssetStatusCount, AssetTypeCount
from ..schemas.common import utcnow
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_TYPES = tuple(get_args(AssetType))
_STATUSES = tuple(get_args(AssetStatus))


class AssetStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> AssetStats:
        """Build fresh asset inventory metrics, optionally scoped to a project."""
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        assets = [
            asset
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.status != "deleted"
            and (project_id is None or asset.project_id == project_id)
        ]

        type_counts: Counter[str] = Counter(asset.type for asset in assets)
        status_counts: Counter[str] = Counter(asset.status for asset in assets)
        by_type = [
            AssetTypeCount(type=asset_type, count=type_counts.get(asset_type, 0))
            for asset_type in _TYPES
        ]
        by_status = [
            AssetStatusCount(status=status, count=status_counts.get(status, 0))
            for status in _STATUSES
        ]

        newest_asset = max(
            assets,
            key=lambda asset: (asset.created_at, str(asset.id)),
            default=None,
        )

        return AssetStats(
            total=len(assets),
            by_type=by_type,
            by_status=by_status,
            total_size_bytes=sum(asset.storage.size_bytes for asset in assets),
            total_versions=sum(asset.version for asset in assets),
            newest_asset_at=newest_asset.created_at if newest_asset else None,
            generated_at=self.clock(),
        )


__all__ = ["AssetStatsRepository"]
