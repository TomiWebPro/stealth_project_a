"""Authoritative publish-feed repository.

The feed is derived fresh from the ``ASSETS`` collection — the same store
``PublishService`` writes a ``publish_receipt`` into on every publish — so it can
never drift from ``GET /publishes/stats`` or from what actually exists. It
deliberately reuses ``publish_stats._parse_receipt`` so the feed and the snapshot
apply identical validity rules: soft-deleted assets and assets without a
well-formed receipt are excluded, and project names are joined from the
authoritative ``PROJECTS`` store (an asset whose project is missing falls back to
a stable display name rather than being dropped).

Ordering is by descending ``(published_at, asset_id)`` so the newest deliverable
comes first and ties are broken deterministically across the in-memory and SQLite
adapters. ``total`` counts the whole filtered feed before the ``limit`` page is
applied. An unknown ``project_id`` raises ``NotFoundError`` for the shared 404
envelope; bounds are validated at the router (shared 422 envelope). There is no
persisted feed or second index — removing this router leaves no collection behind.

Mirrors ``frontend/src/types/publishFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.asset import Asset
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.publish_feed import PublishFeed, PublishFeedItem
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository
from .publish_stats import _parse_receipt

_UNKNOWN_PROJECT_NAME = "Unknown project"


class PublishFeedRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def feed(self, *, project_id: UUID | None = None, limit: int = 50) -> PublishFeed:
        """Build the newest-first publish feed, optionally scoped to one project.

        ``total`` counts every published asset in scope before the ``limit`` page
        is applied. ``items`` holds at most ``limit`` entries in descending
        publish-time order with a stable asset-id tie-break.
        """
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        items: list[PublishFeedItem] = []
        for asset in self._load_all(Collections.ASSETS, Asset):
            if asset.status == "deleted":
                continue
            parsed = _parse_receipt(asset.metadata.get("publish_receipt"))
            if parsed is None:
                continue
            if project_id is not None and asset.project_id != project_id:
                continue
            version, size_bytes, published = parsed
            items.append(
                PublishFeedItem(
                    asset_id=asset.id,
                    asset_name=asset.name,
                    asset_type=asset.type,
                    project_id=asset.project_id,
                    project_name=project_names.get(asset.project_id, _UNKNOWN_PROJECT_NAME),
                    version=version,
                    size_bytes=size_bytes,
                    published_at=published,
                )
            )

        items.sort(key=lambda item: (item.published_at, str(item.asset_id)), reverse=True)

        return PublishFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["PublishFeedRepository", "_UNKNOWN_PROJECT_NAME"]
