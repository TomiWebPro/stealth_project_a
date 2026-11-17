"""Authoritative asset tag facet repository.

Tag facets are derived from the asset store on every call: there is no second
index to drift and removing the router leaves no orphaned collection behind.
Deleted assets are excluded, tag matching is exact (case-sensitive), and an
optional ``prefix`` narrows results for autocomplete. Both ``project_id`` and
``prefix`` filters are applied before computing counts, so ``total`` is the
number of distinct tags matching the query before ``limit`` is applied.

Mirrors ``frontend/src/types/tags.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from uuid import UUID

from ..errors import NotFoundError
from ..schemas.asset import Asset
from ..schemas.common import utcnow
from ..schemas.tags import TagFacet, TagIndex
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository


class TagRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def index(
        self,
        *,
        project_id: UUID | None = None,
        prefix: str | None = None,
        limit: int = 50,
    ) -> TagIndex:
        """Build a most-used-first tag index derived from the asset store.

        An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
        envelope is used (same behaviour as the other project-scoped routers).
        """
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        needle = prefix.casefold() if prefix else None
        counts: Counter[str] = Counter()
        for asset in self._load_all(Collections.ASSETS, Asset):
            if asset.status == "deleted":
                continue
            if project_id is not None and asset.project_id != project_id:
                continue
            # Count each tag at most once per asset (an asset carrying the same
            # tag twice is still one asset with that tag).
            for tag in set(asset.tags):
                if not tag or (needle is not None and not tag.casefold().startswith(needle)):
                    continue
                counts[tag] += 1

        facets = [TagFacet(name=name, count=count) for name, count in counts.items()]
        # Highest count first; stable lexical tie-break keeps the order identical
        # across the memory and SQLite stores (whose iteration order may differ).
        facets.sort(key=lambda facet: (-facet.count, facet.name.casefold(), facet.name))
        return TagIndex(tags=facets[:limit], total=len(facets))


__all__ = ["TagRepository"]
