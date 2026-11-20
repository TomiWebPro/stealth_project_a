"""Authoritative single lineage-relationship overview repository.

The snapshot is derived fresh from the authoritative ``ASSET_RELATIONSHIPS``
collection on every call, like ``LineageFeedRepository``/``LineageStatsRepository``:
there is no second index to drift and removing the router leaves no collection
behind. Only links whose source asset is live are part of the canonical set —
exactly as in the feed and the snapshot — so a relationship whose source is
soft-deleted/unknown is treated as not found (shared 404 envelope).

``counts`` reuses that canonical relationship set so the single view cannot
disagree with ``/lineage/stats``/``/lineage/feed``, and ``recent_relationships``
reuses the canonical ``LineageFeedItem`` projection from ``/lineage/feed``.
Asset/project display names are joined from the authoritative ``ASSETS`` /
``PROJECTS`` stores with stable fallbacks, and ordering uses the same
``(created_at, id)`` tie-break as the feed across both storage adapters.

The ``recent_limit`` query bound is validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/lineageOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..errors import NotFoundError
from ..schemas.asset import Asset, AssetRelationship
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.lineage_feed import LineageFeedItem
from ..schemas.lineage_overview import LineageOverview, LineageOverviewCounts
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"
_UNKNOWN_ASSET_NAME = "Unknown asset"


class LineageOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def overview(self, relationship_id: UUID, *, recent_limit: int = 5) -> LineageOverview:
        """Build a fresh snapshot for one relationship."""
        live_assets: dict[UUID, Asset] = {
            asset.id: asset
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.status != "deleted"
        }
        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        # Match the feed/stats exclusion so the overview cannot surface a link the
        # other lineage views omit (and so the source asset always has a project).
        canonical = [
            rel
            for rel in self._load_all(Collections.ASSET_RELATIONSHIPS, AssetRelationship)
            if rel.from_asset_id in live_assets
        ]
        target = next((rel for rel in canonical if rel.id == relationship_id), None)
        if target is None:
            raise NotFoundError("relationship", str(relationship_id), code="relationship_not_found")

        source = live_assets[target.from_asset_id]
        related = live_assets.get(target.to_asset_id)
        project_id = source.project_id
        project_name = project_names.get(project_id, _UNKNOWN_PROJECT_NAME)

        # Whole-source-asset activity, derived from the same canonical set as the
        # feed/snapshot and never bounded by the page.
        source_upstream = [
            rel for rel in canonical if rel.to_asset_id == source.id
        ]
        source_downstream = [
            rel for rel in canonical if rel.from_asset_id == source.id
        ]
        source_types = {rel.type for rel in source_upstream + source_downstream}
        project_relationships = [
            rel
            for rel in canonical
            if live_assets[rel.from_asset_id].project_id == project_id
        ]
        counts = LineageOverviewCounts(
            source_upstream=len(source_upstream),
            source_downstream=len(source_downstream),
            source_types=len(source_types),
            project_relationships=len(project_relationships),
        )

        # Same newest-first order and projection as /lineage/feed, scoped to the
        # source asset; counts above stay whole-asset while the page is bounded.
        recent = sorted(
            source_downstream,
            key=lambda rel: (rel.created_at, str(rel.id)),
            reverse=True,
        )[:recent_limit]
        recent_items = [
            LineageFeedItem(
                id=rel.id,
                from_asset_id=rel.from_asset_id,
                to_asset_id=rel.to_asset_id,
                from_asset_name=live_assets[rel.from_asset_id].name,
                to_asset_name=(
                    live_assets[rel.to_asset_id].name
                    if rel.to_asset_id in live_assets
                    else _UNKNOWN_ASSET_NAME
                ),
                project_id=live_assets[rel.from_asset_id].project_id,
                project_name=project_names.get(
                    live_assets[rel.from_asset_id].project_id, _UNKNOWN_PROJECT_NAME
                ),
                type=rel.type,
                created_at=rel.created_at,
            )
            for rel in recent
        ]

        return LineageOverview(
            id=target.id,
            from_asset_id=target.from_asset_id,
            to_asset_id=target.to_asset_id,
            from_asset_name=source.name,
            to_asset_name=related.name if related is not None else _UNKNOWN_ASSET_NAME,
            from_asset_type=source.type,
            to_asset_type=related.type if related is not None else None,
            project_id=project_id,
            project_name=project_name,
            type=target.type,
            created_at=target.created_at,
            counts=counts,
            recent_relationships=recent_items,
            generated_at=self.clock(),
        )


__all__ = [
    "LineageOverviewRepository",
    "_UNKNOWN_ASSET_NAME",
    "_UNKNOWN_PROJECT_NAME",
]
