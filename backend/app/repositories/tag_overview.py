"""Authoritative single-tag overview repository.

The snapshot is derived fresh from the authoritative ``ASSETS`` store on every
call, like ``TagRepository`` and ``AssetFeedRepository``: there is no second index
to drift and removing the router leaves no collection behind. The tag-match rule
(exact, case-sensitive membership in ``asset.tags``) and the deleted-asset
exclusion are identical to ``/tags``, so ``counts.tagged_assets`` always equals
the facet count returned by ``GET /tags`` for the same project scope. The recent
page reuses ``AssetFeedItem`` from ``/assets/feed`` so the two views cannot
disagree about an asset's projected shape.

An unknown tag (no live asset in scope carries it) raises ``NotFoundError`` for
the shared 404 ``tag_not_found`` envelope; an unknown project uses the same
shared 404 envelope via ``ProjectRepository``. Bounds validation happens at the
router (shared 422 envelope).

Mirrors ``frontend/src/types/tagOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..errors import NotFoundError
from ..schemas.asset import Asset
from ..schemas.asset_feed import AssetFeedItem
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.tag_overview import TagOverview, TagOverviewCounts
from ..storage.base import Collections, DocumentStore
from .asset_feed import _UNKNOWN_PROJECT_NAME
from .base import BaseRepository
from .projects import ProjectRepository


class TagOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def overview(
        self,
        tag: str,
        *,
        project_id: UUID | None = None,
        recent_limit: int = 5,
    ) -> TagOverview:
        """Build a fresh snapshot for one tag, newest tagged asset first."""
        project_name: str | None = None
        if project_id is not None:
            project_name = self.projects.get_or_raise(project_id).name

        project_names = {
            candidate.id: candidate.name
            for candidate in self._load_all(Collections.PROJECTS, Project)
        }

        # Same filtering as TagRepository.index: live assets only, optional
        # project scope, exact (case-sensitive) tag membership counted at most
        # once per asset. No second index, so the two views cannot drift.
        tagged: list[Asset] = []
        scope_assets = 0
        for asset in self._load_all(Collections.ASSETS, Asset):
            if asset.status == "deleted":
                continue
            if project_id is not None and asset.project_id != project_id:
                continue
            scope_assets += 1
            if tag in asset.tags:
                tagged.append(asset)

        if not tagged:
            raise NotFoundError("tag", tag, code="tag_not_found")

        counts = TagOverviewCounts(
            tagged_assets=len(tagged),
            tagged_projects=len({asset.project_id for asset in tagged}),
            scope_assets=scope_assets,
        )

        tagged.sort(key=lambda asset: (asset.created_at, str(asset.id)), reverse=True)
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
            for asset in tagged
        ]

        return TagOverview(
            tag=tag,
            project_id=project_id,
            project_name=project_name,
            counts=counts,
            recent_assets=items[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["TagOverviewRepository"]
