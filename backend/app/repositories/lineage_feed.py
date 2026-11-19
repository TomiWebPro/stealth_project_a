"""Authoritative asset lineage-feed repository.

The feed is derived fresh from the ``ASSET_RELATIONSHIPS`` collection — the same
store ``AssetRepository`` writes on register (via ``parent_asset_ids``) and
``LineageStatsRepository`` aggregates — so it can never drift from the snapshot.
There is no persisted feed or second index; removing this router leaves no
collection behind.

A relationship is attributed to the project of its source (``from_asset_id``)
asset and links from soft-deleted/unknown sources are excluded, exactly as in
``LineageStatsRepository``. This keeps the feed's ``total`` consistent with the
snapshot's ``total_relationships``. A soft-deleted or unknown target is kept but
its display name falls back to a stable sentinel. Project and asset display names
are joined from the authoritative ``PROJECTS`` / ``ASSETS`` stores with stable
fallbacks. Ordering is by descending ``(created_at, id)`` so the newest link comes
first and ties are broken deterministically across the in-memory and SQLite
adapters. ``total`` counts the whole filtered feed before the ``limit`` page is
applied. An optional ``project_id`` scope validates the project first so an
unknown id uses the shared 404 envelope; bounds are validated at the router
(shared 422 envelope).

Mirrors ``frontend/src/types/lineageFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.asset import Asset, AssetRelationship
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.lineage_feed import LineageFeed, LineageFeedItem
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"
_UNKNOWN_ASSET_NAME = "Unknown asset"


class LineageFeedRepository(BaseRepository):
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
    ) -> LineageFeed:
        """Build the newest-first lineage feed, optionally scoped to a project.

        An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
        envelope is used (same behaviour as the other project-scoped routers).
        ``total`` counts every relationship in scope before the ``limit`` page is
        applied.
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

        # A relationship belongs to the project of its source asset; links from
        # soft-deleted/unknown sources are excluded, matching LineageStatsRepository
        # so the feed total agrees with the aggregate snapshot.
        relationships = [
            rel
            for rel in self._load_all(
                Collections.ASSET_RELATIONSHIPS, AssetRelationship
            )
            if rel.from_asset_id in assets_by_id
            and (
                project_id is None
                or assets_by_id[rel.from_asset_id].project_id == project_id
            )
        ]
        # (created_at, id) gives a deterministic newest-first order across both
        # storage adapters.
        relationships.sort(
            key=lambda rel: (rel.created_at, str(rel.id)),
            reverse=True,
        )

        items: list[LineageFeedItem] = []
        for rel in relationships:
            source = assets_by_id[rel.from_asset_id]
            target = assets_by_id.get(rel.to_asset_id)
            items.append(
                LineageFeedItem(
                    id=rel.id,
                    from_asset_id=rel.from_asset_id,
                    to_asset_id=rel.to_asset_id,
                    from_asset_name=source.name,
                    to_asset_name=(
                        target.name if target is not None else _UNKNOWN_ASSET_NAME
                    ),
                    project_id=source.project_id,
                    project_name=project_names.get(
                        source.project_id, _UNKNOWN_PROJECT_NAME
                    ),
                    type=rel.type,
                    created_at=rel.created_at,
                )
            )

        return LineageFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = [
    "LineageFeedRepository",
    "_UNKNOWN_ASSET_NAME",
    "_UNKNOWN_PROJECT_NAME",
]
