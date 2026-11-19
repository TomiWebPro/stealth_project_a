"""Authoritative production-pipeline statistics repository.

Statistics are derived from the three authoritative chain collections on every
call (like ``ProjectStatsRepository`` and ``DashboardRepository``): there is no
second index to drift and removing the router leaves no collection behind.

``by_kind`` is zero-filled over the canonical pipeline kinds so the wire shape
is stable across the in-memory and SQLite stores. ``by_project`` is sorted by
descending chain count then project id for deterministic cross-backend
ordering. An unknown ``project_id`` raises ``NotFoundError`` so the shared 404
envelope is used, matching the other project-scoped routers.

Mirrors ``frontend/src/types/pipelineStats.ts`` contracts.
"""

from __future__ import annotations

from collections import Counter
from typing import get_args
from uuid import UUID

from pydantic import BaseModel

from ..errors import NotFoundError
from ..schemas.common import utcnow
from ..schemas.pipeline_stats import (
    PipelineKind,
    PipelineKindStats,
    PipelineProjectCount,
    PipelineStats,
)
from ..shots import ShotChain
from ..splat import SplatChain
from ..storage.base import Collections, DocumentStore
from ..training import LoraChain
from .base import BaseRepository
from .projects import ProjectRepository

_KINDS = tuple(get_args(PipelineKind))


class PipelineStatsRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def stats(self, *, project_id: UUID | None = None) -> PipelineStats:
        """Build fresh pipeline metrics, optionally scoped to a project."""
        if project_id is not None:
            self.projects.get_or_raise(project_id)

        # (kind, collection, model) for each authoritative pipeline chain store.
        chain_sources: tuple[tuple[str, str, type[BaseModel]], ...] = (
            ("training", Collections.TRAINING_CHAINS, LoraChain),
            ("shot", Collections.SHOT_CHAINS, ShotChain),
            ("splat", Collections.SPLAT_CHAINS, SplatChain),
        )

        kind_chains: Counter[str] = Counter()
        kind_jobs: Counter[str] = Counter()
        kind_assets: Counter[str] = Counter()
        project_chains: Counter[UUID] = Counter()
        total_chains = 0
        total_jobs = 0
        total_assets = 0
        newest: BaseModel | None = None

        for kind, collection, model in chain_sources:
            for chain in self._load_all(collection, model):
                if project_id is not None and chain.project_id != project_id:
                    continue
                jobs = _job_count(chain)
                assets = _asset_count(chain)
                kind_chains[kind] += 1
                kind_jobs[kind] += jobs
                kind_assets[kind] += assets
                project_chains[chain.project_id] += 1
                total_chains += 1
                total_jobs += jobs
                total_assets += assets
                if _is_newer(chain, newest):
                    newest = chain

        by_kind = [
            PipelineKindStats(
                kind=kind,
                chains=kind_chains.get(kind, 0),
                jobs=kind_jobs.get(kind, 0),
                assets=kind_assets.get(kind, 0),
            )
            for kind in _KINDS
        ]
        # Most chains first; stable project-id tie-break keeps the order identical
        # across the memory and SQLite stores (whose iteration order may differ).
        by_project = [
            PipelineProjectCount(project_id=current_id, chains=count)
            for current_id, count in sorted(
                project_chains.items(), key=lambda item: (-item[1], str(item[0]))
            )
        ]

        return PipelineStats(
            total_chains=total_chains,
            total_jobs=total_jobs,
            total_assets=total_assets,
            by_kind=by_kind,
            by_project=by_project,
            newest_chain_at=newest.created_at if newest is not None else None,  # type: ignore[attr-defined]
            generated_at=self.clock(),
        )


def _job_count(chain: BaseModel) -> int:
    """Number of jobs a chain spawned (``job_ids`` list or a single ``job_id``)."""
    job_ids = getattr(chain, "job_ids", None)
    if job_ids is not None:
        return len(job_ids)
    return 1 if getattr(chain, "job_id", None) is not None else 0


def _asset_count(chain: BaseModel) -> int:
    """Number of asset references a chain produced (``*_asset_id`` fields)."""
    return sum(
        1
        for field_name in type(chain).model_fields
        if field_name.endswith("_asset_id") and getattr(chain, field_name, None) is not None
    )


def _is_newer(chain: BaseModel, newest: BaseModel | None) -> bool:
    """Compare chains by ``created_at`` then id for deterministic recency."""
    if newest is None:
        return True
    return (chain.created_at, str(chain.id)) > (newest.created_at, str(newest.id))  # type: ignore[attr-defined]


__all__ = ["PipelineStatsRepository"]
