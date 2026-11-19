"""Authoritative asset lineage statistics repository.

Statistics are derived from the authoritative relationship and asset stores on
every call (like ``PipelineStatsRepository`` and ``AssetStatsRepository``): there
is no second index to drift and removing the router leaves no collection behind.

A relationship belongs to the project of its source (``from_asset_id``) asset.
Relationships whose source asset is soft-deleted or unknown are excluded, matching
the project-scoped and deleted-asset rules used by every other asset-derived
metric. ``by_type`` is zero-filled over the canonical relationship types so the
wire shape is stable across the in-memory and SQLite stores; ``by_project`` is
sorted by descending link count then project id for deterministic cross-backend
ordering. An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
envelope is used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/lineageStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from ..schemas.asset import Asset, AssetRelationship, RelationshipType
from ..schemas.common import utcnow
from ..schemas.lineage_stats import (
    LineageProjectCount,
    LineageStats,
    LineageTypeCount,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_TYPES = tuple(get_args(RelationshipType))


class LineageStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> LineageStats:
        """Build fresh lineage metrics, optionally scoped to a project."""
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        # A relationship is attributed to the project of its source asset. Only
        # live (non-deleted) assets are eligible, as with every other asset-derived
        # metric; a link from a deleted/unknown asset is ignored entirely.
        project_by_asset: dict[UUID, UUID] = {
            asset.id: asset.project_id
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.status != "deleted"
        }

        relationships = [
            rel
            for rel in self._load_all(
                Collections.ASSET_RELATIONSHIPS, AssetRelationship
            )
            if rel.from_asset_id in project_by_asset
        ]
        if project_id is not None:
            relationships = [
                rel
                for rel in relationships
                if project_by_asset[rel.from_asset_id] == project_id
            ]

        type_counts: Counter[str] = Counter(rel.type for rel in relationships)
        project_counts: Counter[UUID] = Counter(
            project_by_asset[rel.from_asset_id] for rel in relationships
        )

        # Distinct live assets present as either endpoint of a counted link. A
        # source asset is always live; a target is counted only when it is live.
        linked_assets: set[UUID] = set()
        for rel in relationships:
            linked_assets.add(rel.from_asset_id)
            if rel.to_asset_id in project_by_asset:
                linked_assets.add(rel.to_asset_id)

        by_type = [
            LineageTypeCount(type=rel_type, count=type_counts.get(rel_type, 0))
            for rel_type in _TYPES
        ]
        # Most-linked projects first; stable project-id tie-break keeps the order
        # identical across the memory and SQLite stores.
        by_project = [
            LineageProjectCount(project_id=current_id, relationships=count)
            for current_id, count in sorted(
                project_counts.items(), key=lambda item: (-item[1], str(item[0]))
            )
        ]

        newest = max(
            relationships,
            key=lambda rel: (rel.created_at, str(rel.id)),
            default=None,
        )

        return LineageStats(
            total_relationships=len(relationships),
            total_linked_assets=len(linked_assets),
            by_type=by_type,
            by_project=by_project,
            newest_relationship_at=newest.created_at if newest is not None else None,
            generated_at=self.clock(),
        )


__all__ = ["LineageStatsRepository"]
