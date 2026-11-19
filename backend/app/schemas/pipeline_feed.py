"""Authoritative production-pipeline feed contracts.

``GET /pipelines/feed`` is a newest-first, workspace-wide view of pipeline chains
derived fresh from the three authoritative chain collections (LoRA training, shot
video and splat/COLMAP) — the same stores ``/pipelines`` lists and
``/pipelines/stats`` aggregates — so there is no second index and no cached feed
to drift. It complements ``/pipelines/stats`` (aggregates) by projecting every
chain with its kind, joined project display name, job/asset counts and creation
time in recency order.

Each item carries the chain id, project id/name, canonical kind, the number of
jobs the chain spawned and assets it produced (reusing the same derivation as
``/pipelines/stats`` so the two cannot disagree), creator and creation time.
``PipelineFeed`` carries a whole-scope ``total`` counted before the ``limit``
page is applied. Optional ``project_id`` and ``kind`` filters narrow the same
derivation; invalid filter values use the shared 422 envelope at the router.

Mirrored in ``frontend/src/types/pipelineFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .pipeline_stats import PipelineKind


class PipelineFeedItem(ContractModel):
    """One pipeline chain projected from the authoritative chain stores."""

    chain_id: UUID
    project_id: UUID
    project_name: str
    kind: PipelineKind
    job_count: int = Field(ge=0)
    asset_count: int = Field(ge=0)
    created_by: UUID
    created_at: Timestamp


class PipelineFeed(ContractModel):
    """A bounded, newest-first page of pipeline chains with a whole-scope total.

    ``total`` counts every chain in scope before paging. ``items`` holds at most
    ``limit`` entries in descending ``(created_at, chain_id)`` order.
    """

    items: list[PipelineFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "PipelineFeed",
    "PipelineFeedItem",
]
