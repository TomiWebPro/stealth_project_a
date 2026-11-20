"""Authoritative single publish-receipt overview repository.

The snapshot is derived fresh from the authoritative ``ASSETS`` store on every
call, like ``PublishFeedRepository`` and ``PublishStatsRepository``: there is no
second index to drift and removing the router leaves no collection behind. The
receipt validity rule reuses ``publish_stats._parse_receipt`` and the sibling
wire shape reuses ``PublishFeedItem``, so the overview cannot disagree with
``/publishes/feed`` or ``/publishes/stats``.

Only live (non-deleted) assets with a well-formed receipt contribute to the
counts and the sibling page. Siblings are scoped to the target asset's project
and ordered newest-first with a deterministic ``(published_at, asset_id)``
tie-break across both storage adapters, while ``counts`` describe whole scopes
and are never bounded by ``recent_limit``. Project names are joined from the
authoritative ``PROJECTS`` store with a stable fallback for orphan assets.

An unknown asset raises ``NotFoundError`` for the shared 404
``asset_not_found`` envelope; an asset without a usable receipt raises the
shared 404 ``publish_not_found`` envelope. Bounds validation happens at the
router (shared 422 envelope).

Mirrors ``frontend/src/types/publishOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..errors import NotFoundError
from ..schemas.asset import Asset
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.publish_feed import PublishFeedItem
from ..schemas.publish_overview import PublishOverview, PublishOverviewCounts
from ..storage.base import Collections, DocumentStore
from .assets import AssetRepository
from .base import BaseRepository
from .projects import ProjectRepository
from .publish_feed import _UNKNOWN_PROJECT_NAME
from .publish_stats import _parse_receipt


class PublishOverviewRepository(BaseRepository):
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

    def overview(self, asset_id: UUID, *, recent_limit: int = 5) -> PublishOverview:
        """Build a fresh snapshot for one publish receipt, newest sibling first."""
        asset = self.assets.get_or_raise(asset_id)

        parsed = _parse_receipt(asset.metadata.get("publish_receipt"))
        if asset.status == "deleted" or parsed is None:
            raise NotFoundError("publish", str(asset_id), code="publish_not_found")
        version, size_bytes, published = parsed

        project = self._load(Collections.PROJECTS, str(asset.project_id), Project)
        project_name = project.name if project is not None else _UNKNOWN_PROJECT_NAME

        project_names = {
            candidate.id: candidate.name
            for candidate in self._load_all(Collections.PROJECTS, Project)
        }
        items: list[PublishFeedItem] = []
        for candidate in self._load_all(Collections.ASSETS, Asset):
            if candidate.status == "deleted":
                continue
            receipt = _parse_receipt(candidate.metadata.get("publish_receipt"))
            if receipt is None:
                continue
            candidate_version, candidate_bytes, candidate_published = receipt
            items.append(
                PublishFeedItem(
                    asset_id=candidate.id,
                    asset_name=candidate.name,
                    asset_type=candidate.type,
                    project_id=candidate.project_id,
                    project_name=project_names.get(
                        candidate.project_id, _UNKNOWN_PROJECT_NAME
                    ),
                    version=candidate_version,
                    size_bytes=candidate_bytes,
                    published_at=candidate_published,
                )
            )

        siblings = [
            item for item in items if item.project_id == asset.project_id
        ]
        siblings.sort(
            key=lambda item: (item.published_at, str(item.asset_id)), reverse=True
        )
        counts = PublishOverviewCounts(
            project_published=len(siblings),
            project_bytes=sum(item.size_bytes for item in siblings),
            total_published=len(items),
        )

        return PublishOverview(
            asset_id=asset.id,
            asset_name=asset.name,
            asset_type=asset.type,
            project_id=asset.project_id,
            project_name=project_name,
            version=version,
            size_bytes=size_bytes,
            published_at=published,
            counts=counts,
            recent_siblings=siblings[:recent_limit],
            generated_at=self.clock(),
        )


__all__ = ["PublishOverviewRepository"]
