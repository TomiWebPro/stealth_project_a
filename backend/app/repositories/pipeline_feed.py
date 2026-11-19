"""Authoritative production-pipeline feed repository.

The feed is derived fresh from the three authoritative chain collections — the
same stores ``/pipelines`` lists and ``/pipelines/stats`` aggregates — so it can
never drift from either. There is no persisted feed or second index; removing
this router leaves no collection behind.

Each chain is projected with its canonical kind, joined project display name
(missing projects fall back to a stable name rather than being dropped) and the
same job/asset counts ``PipelineStatsRepository`` computes. Items are sorted
descending ``(created_at, chain_id)`` so the newest chain comes first and ties
break deterministically across the in-memory and SQLite adapters. ``total``
counts the whole filtered feed before the ``limit`` page is applied. Optional
``project_id`` and ``kind`` filters narrow the same derivation; an unknown
``project_id`` raises ``NotFoundError`` for the shared 404 envelope and bounds
are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/pipelineFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.pipeline_feed import PipelineFeed, PipelineFeedItem
from ..schemas.pipeline_stats import PipelineKind
from ..shots import ShotChain
from ..splat import SplatChain
from ..storage.base import Collections, DocumentStore
from ..training import LoraChain
from .base import BaseRepository
from .pipeline_stats import _asset_count, _job_count
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"

# (kind, collection, model) for each authoritative pipeline chain store — the
# same sources PipelineStatsRepository aggregates.
_CHAIN_SOURCES: tuple[tuple[str, str, type[BaseModel]], ...] = (
    ("training", Collections.TRAINING_CHAINS, LoraChain),
    ("shot", Collections.SHOT_CHAINS, ShotChain),
    ("splat", Collections.SPLAT_CHAINS, SplatChain),
)


class PipelineFeedRepository(BaseRepository):
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
        kind: PipelineKind | None = None,
        limit: int = 50,
    ) -> PipelineFeed:
        """Build the newest-first pipeline-chain feed, optionally scoped."""
        if project_id is not None:
            # Unknown-but-well-formed id uses the shared 404 envelope.
            self.projects.get_or_raise(project_id)

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        items: list[PipelineFeedItem] = []
        for chain_kind, collection, model in _CHAIN_SOURCES:
            if kind is not None and chain_kind != kind:
                continue
            for chain in self._load_all(collection, model):
                if project_id is not None and chain.project_id != project_id:  # type: ignore[attr-defined]
                    continue
                items.append(
                    PipelineFeedItem(
                        chain_id=chain.id,  # type: ignore[attr-defined]
                        project_id=chain.project_id,  # type: ignore[attr-defined]
                        project_name=project_names.get(
                            chain.project_id, _UNKNOWN_PROJECT_NAME  # type: ignore[attr-defined]
                        ),
                        kind=chain_kind,  # type: ignore[arg-type]
                        job_count=_job_count(chain),
                        asset_count=_asset_count(chain),
                        created_by=chain.created_by,  # type: ignore[attr-defined]
                        created_at=chain.created_at,  # type: ignore[attr-defined]
                    )
                )

        items.sort(
            key=lambda item: (item.created_at, str(item.chain_id)),
            reverse=True,
        )

        return PipelineFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["PipelineFeedRepository", "_UNKNOWN_PROJECT_NAME"]
