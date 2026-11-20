"""Authoritative single-pipeline-chain overview contracts.

The pipeline detail UI needs a compact, single-chain snapshot: identity, the
canonical kind, whole-scope job/asset counts and a few recent linked jobs and
assets. Deriving it on the backend — where the three chain collections, jobs and
assets are authoritative — keeps every client reading the same numbers and
avoids reproducing the chain projection per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
The ``counts`` describe the whole chain while ``recent_jobs``/``recent_assets``
are newest-first and bounded by ``recent_limit``. Job/asset references are
resolved from the authoritative stores (orphan and soft-deleted assets are
skipped), so the overview cannot disagree with ``/pipelines/stats`` and
``/pipelines/feed``. Mirrors ``frontend/src/types/chainOverview.ts`` — parity is
enforced by ``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .asset import AssetType
from .common import ContractModel, NonEmptyStr, Timestamp
from .operation import JobStatus
from .pipeline_stats import PipelineKind


class ChainOverviewCounts(ContractModel):
    """Whole-scope totals for one chain, derived authoritatively."""

    jobs: int = Field(ge=0)
    assets: int = Field(ge=0)


class ChainJobRef(ContractModel):
    """A job linked from a chain, resolved from the authoritative job store."""

    job_id: UUID
    operation_id: NonEmptyStr
    status: JobStatus
    created_at: Timestamp


class ChainAssetRef(ContractModel):
    """An asset produced by a chain, resolved from the authoritative asset store."""

    asset_id: UUID
    name: NonEmptyStr
    asset_type: AssetType
    created_at: Timestamp


class ChainOverview(ContractModel):
    """A single-chain snapshot: identity, counts and recent linked items.

    ``counts`` is never bounded by ``recent_limit``; ``recent_jobs`` and
    ``recent_assets`` are newest-first (deterministic id tie-break) and bounded
    by it. ``project_name`` falls back to a stable name when the project is
    missing so the overview is never dropped.
    """

    chain_id: UUID
    project_id: UUID
    project_name: str
    kind: PipelineKind
    created_by: UUID
    created_at: Timestamp
    counts: ChainOverviewCounts
    recent_jobs: list[ChainJobRef] = Field(default_factory=list)
    recent_assets: list[ChainAssetRef] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = [
    "ChainOverview",
    "ChainOverviewCounts",
    "ChainJobRef",
    "ChainAssetRef",
]
