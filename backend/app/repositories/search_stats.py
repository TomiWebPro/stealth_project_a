"""Authoritative search index statistics repository.

Search statistics are derived from the same authoritative stores the cross-domain
``SearchRepository`` reads on every call, so the snapshot can never drift from
what ``/search`` can actually return: there is no second index to maintain and
removing the router leaves no collection behind.

``by_kind`` is zero-filled over the canonical ``SearchResultKind`` values in
their documented order so the wire shape is identical across the in-memory and
SQLite stores. Soft-deleted assets are excluded, matching ``/search``. An
unknown ``project_id`` raises ``NotFoundError`` so the shared 404 envelope is
used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/searchStats.ts`` contracts.
"""

from __future__ import annotations

from typing import get_args
from uuid import UUID

from ..schemas.asset import Asset
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.conversation import Conversation
from ..schemas.search import SearchResultKind
from ..schemas.search_stats import SearchKindCount, SearchStats
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository

_KINDS = tuple(get_args(SearchResultKind))


class SearchStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> SearchStats:
        """Build fresh search-index metrics, optionally scoped to a project."""
        scoped_project = None
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            scoped_project = self.projects.get_or_raise(project_id)

        # A scoped project is itself a searchable project document; workspace-wide
        # stats count every project. Assets/conversations are narrowed to the scope
        # and soft-deleted assets are excluded exactly as ``/search`` does.
        project_documents = (
            [scoped_project]
            if scoped_project is not None
            else self._load_all(Collections.PROJECTS, Project)
        )
        asset_documents = [
            asset
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.status != "deleted"
            and (project_id is None or asset.project_id == project_id)
        ]
        conversation_documents = [
            conversation
            for conversation in self._load_all(Collections.CONVERSATIONS, Conversation)
            if project_id is None or conversation.project_id == project_id
        ]

        counts = {
            "project": len(project_documents),
            "asset": len(asset_documents),
            "conversation": len(conversation_documents),
        }
        by_kind = [
            SearchKindCount(kind=kind, count=counts.get(kind, 0))
            for kind in _KINDS
        ]

        newest = max(
            (
                document.updated_at
                for document in (
                    *project_documents,
                    *asset_documents,
                    *conversation_documents,
                )
            ),
            default=None,
        )

        return SearchStats(
            total_documents=sum(counts.values()),
            by_kind=by_kind,
            newest_document_at=newest,
            generated_at=self.clock(),
        )


__all__ = ["SearchStatsRepository"]
