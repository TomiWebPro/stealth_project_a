"""Authoritative single-pipeline-chain overview repository.

The snapshot is derived fresh from the three authoritative chain collections —
the same stores ``/pipelines`` lists and ``/pipelines/stats`` aggregates — with
the linked jobs/assets resolved from the authoritative job/asset stores. There
is no second index to drift and removing the router leaves no collection behind.

The whole-scope ``counts`` reuse the exact derivation ``PipelineStatsRepository``
and ``PipelineFeedRepository`` use (so the overview can never disagree with
those views), while ``recent_jobs``/``recent_assets`` are bounded newest-first
projections of the linked ids. An unknown chain raises ``NotFoundError`` for the
shared 404 ``chain_not_found`` envelope; the ``recent_limit`` bound is validated
at the router (shared 422 envelope).

Mirrors ``frontend/src/types/chainOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from ..errors import NotFoundError
from ..schemas.asset import Asset
from ..schemas.auth import Project
from ..schemas.chain_overview import (
    ChainAssetRef,
    ChainJobRef,
    ChainOverview,
    ChainOverviewCounts,
)
from ..schemas.common import utcnow
from ..schemas.operation import Job
from ..shots import ShotChain
from ..splat import SplatChain
from ..storage.base import Collections, DocumentStore
from ..training import LoraChain
from .base import BaseRepository
from .pipeline_stats import _asset_count, _job_count
from .projects import ProjectRepository

_UNKNOWN_PROJECT_NAME = "Unknown project"

# (kind, collection, model) for each authoritative pipeline chain store — the
# same sources PipelineStatsRepository aggregates and PipelineFeedRepository reads.
_CHAIN_SOURCES: tuple[tuple[str, str, type[BaseModel]], ...] = (
    ("training", Collections.TRAINING_CHAINS, LoraChain),
    ("shot", Collections.SHOT_CHAINS, ShotChain),
    ("splat", Collections.SPLAT_CHAINS, SplatChain),
)


class ChainOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def overview(self, chain_id: UUID, *, recent_limit: int = 5) -> ChainOverview:
        """Build a fresh snapshot for one pipeline chain."""
        chain, kind = self._find_chain(chain_id)
        if chain is None or kind is None:
            raise NotFoundError("Pipeline chain", str(chain_id), code="chain_not_found")

        project_names = {
            project.id: project.name
            for project in self._load_all(Collections.PROJECTS, Project)
        }

        job_ids = _linked_job_ids(chain)
        asset_ids = _linked_asset_ids(chain)

        counts = ChainOverviewCounts(
            jobs=_job_count(chain),
            assets=_asset_count(chain),
        )

        jobs: list[Job] = [
            job
            for job in (_load_job(self.store, job_id) for job_id in job_ids)
            if job is not None
        ]
        jobs.sort(key=lambda job: (job.created_at, str(job.id)), reverse=True)

        assets: list[Asset] = [
            asset
            for asset in (_load_asset(self.store, asset_id) for asset_id in asset_ids)
            if asset is not None and asset.status != "deleted"
        ]
        assets.sort(key=lambda asset: (asset.created_at, str(asset.id)), reverse=True)

        recent_jobs = [
            ChainJobRef(
                job_id=job.id,
                operation_id=job.operation_id,
                status=job.status,
                created_at=job.created_at,
            )
            for job in jobs[:recent_limit]
        ]
        recent_assets = [
            ChainAssetRef(
                asset_id=asset.id,
                name=asset.name,
                asset_type=asset.type,
                created_at=asset.created_at,
            )
            for asset in assets[:recent_limit]
        ]

        return ChainOverview(
            chain_id=chain_id,
            project_id=chain.project_id,  # type: ignore[attr-defined]
            project_name=project_names.get(
                chain.project_id, _UNKNOWN_PROJECT_NAME  # type: ignore[attr-defined]
            ),
            kind=kind,  # type: ignore[arg-type]
            created_by=chain.created_by,  # type: ignore[attr-defined]
            created_at=chain.created_at,  # type: ignore[attr-defined]
            counts=counts,
            recent_jobs=recent_jobs,
            recent_assets=recent_assets,
            generated_at=self.clock(),
        )

    def _find_chain(
        self, chain_id: UUID
    ) -> tuple[BaseModel | None, str | None]:
        """Locate a chain across the three authoritative collections."""
        for kind, collection, model in _CHAIN_SOURCES:
            for chain in self._load_all(collection, model):
                if chain.id == chain_id:  # type: ignore[attr-defined]
                    return chain, kind
        return None, None


def _linked_job_ids(chain: BaseModel) -> list[UUID]:
    """Job ids referenced by a chain, deduplicated in stable order."""
    job_ids = getattr(chain, "job_ids", None)
    if job_ids is not None:
        return list(job_ids)
    job_id = getattr(chain, "job_id", None)
    return [job_id] if job_id is not None else []


def _linked_asset_ids(chain: BaseModel) -> list[UUID]:
    """Asset ids referenced by a chain's ``*_asset_id`` fields, de-duplicated."""
    ids: list[UUID] = []
    for field_name in type(chain).model_fields:
        if not field_name.endswith("_asset_id"):
            continue
        asset_id = getattr(chain, field_name, None)
        if asset_id is not None and asset_id not in ids:
            ids.append(asset_id)
    return ids


def _load_job(store: DocumentStore, job_id: UUID) -> Job | None:
    document = store.get(Collections.JOBS, str(job_id))
    return Job.model_validate(document) if document is not None else None


def _load_asset(store: DocumentStore, asset_id: UUID) -> Asset | None:
    document = store.get(Collections.ASSETS, str(asset_id))
    return Asset.model_validate(document) if document is not None else None


__all__ = ["ChainOverviewRepository", "_UNKNOWN_PROJECT_NAME"]
