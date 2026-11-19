"""Authoritative production-pipeline statistics contracts.

The P4 pipeline services (LoRA training, shot video generation and splat/COLMAP)
each persist a chain document in their own authoritative collection. This
snapshot reports how many chains have run, the jobs they spawned and the assets
they produced, with a zero-filled per-kind breakdown and a per-project
breakdown, so the UI never has to reproduce the aggregation rules or read the
chain collections directly.

Everything is computed fresh from the authoritative chain stores on every call:
there is no second index to drift. ``by_kind`` is zero-filled over every
canonical pipeline kind and ``by_project`` is sorted by descending chain count
then project id for deterministic cross-backend ordering. An optional
``project_id`` narrows the same derivation to one project.

Mirrored in ``frontend/src/types/pipelineStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp

PipelineKind = Literal["training", "shot", "splat"]


class PipelineKindStats(ContractModel):
    """Chain/job/asset totals for one production-pipeline kind."""

    kind: PipelineKind
    chains: int = Field(ge=0)
    jobs: int = Field(ge=0)
    assets: int = Field(ge=0)


class PipelineProjectCount(ContractModel):
    """Number of pipeline chains produced for one project."""

    project_id: UUID
    chains: int = Field(ge=0)


class PipelineStats(ContractModel):
    """Pipeline execution metrics derived from the authoritative chain stores.

    ``by_kind`` is zero-filled over every canonical pipeline kind so a UI can
    read a bucket without guarding for a missing key. ``by_project`` lists only
    projects that have at least one chain, sorted by descending chain count then
    project id. ``newest_chain_at`` is the most recent chain ``created_at``
    (``None`` when there are no chains).
    """

    total_chains: int = Field(ge=0)
    total_jobs: int = Field(ge=0)
    total_assets: int = Field(ge=0)
    by_kind: list[PipelineKindStats] = Field(default_factory=list)
    by_project: list[PipelineProjectCount] = Field(default_factory=list)
    newest_chain_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "PipelineKind",
    "PipelineKindStats",
    "PipelineProjectCount",
    "PipelineStats",
]
