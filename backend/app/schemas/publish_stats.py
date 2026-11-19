"""Authoritative publish statistics contracts.

``PublishService.publish`` records a receipt inside each published asset's
``metadata['publish_receipt']`` in the authoritative ``ASSETS`` collection. This
snapshot reports the size and shape of those receipts: how many assets are
published, how many bytes were delivered, the distribution across version
numbers, per-project publish activity, the newest publish time and when the
snapshot was generated.

Everything is computed fresh from the authoritative asset store on every call;
there is no second index to drift. Soft-deleted assets and assets without a
well-formed receipt are excluded, so the totals and the per-project breakdown
cannot disagree. ``by_version`` is ordered by ascending version number and
``by_project`` by descending published count then project id, keeping the wire
shape deterministic across the in-memory and SQLite stores. An optional
``project_id`` narrows the same derivation to one project.

Mirrored in ``frontend/src/types/publishStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp


class PublishVersionCount(ContractModel):
    """Number of published assets at a given version number."""

    version: int = Field(ge=1)
    count: int = Field(ge=0)


class PublishProjectCount(ContractModel):
    """Publish activity recorded for one project."""

    project_id: UUID
    published: int = Field(ge=0)
    bytes: int = Field(ge=0)


class PublishStats(ContractModel):
    """Publish metrics derived from authoritative asset publish receipts.

    ``total_published`` counts live assets carrying a well-formed publish
    receipt. ``total_bytes`` sums the delivered byte size of those receipts.
    ``by_version`` groups published assets by their receipt version number in
    ascending order; ``by_project`` is ordered by descending published count
    then project id. ``newest_published_at`` is ``None`` when nothing is
    published in scope.
    """

    total_published: int = Field(ge=0)
    total_bytes: int = Field(ge=0)
    by_version: list[PublishVersionCount] = Field(default_factory=list)
    by_project: list[PublishProjectCount] = Field(default_factory=list)
    newest_published_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "PublishVersionCount",
    "PublishProjectCount",
    "PublishStats",
]
