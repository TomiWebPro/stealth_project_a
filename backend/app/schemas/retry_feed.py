"""Authoritative job retry feed contracts.

``GET /retries/feed`` is a newest-first, workspace-wide view of retried jobs
derived fresh from the authoritative ``JOB_RETRIES`` idempotency ledger — the
same collection ``JobRepository.retry`` writes on every accepted retry and
``RetryStatsRepository`` aggregates — so there is no second index and no cached
feed to drift. It complements ``GET /retries/stats`` (an aggregate snapshot) by
projecting each retried job with its current lifecycle state and the number of
accepted retries recorded for it.

The ledger is timestamp-free: a job appears once in the feed regardless of how
many times it was retried, and its ``retried_at`` is the most recent activity
timestamp (created/started/finished) of the joined job — the same recency signal
``/retries/stats`` uses for ``newest_retry_at``. Ledger entries whose job no
longer exists are excluded, keeping the feed consistent with the aggregate.
``RetryFeed`` carries a whole-scope ``total`` counted before the ``limit`` page
is applied, so a UI can show both feed depth and a bounded page in one call.

Mirrored in ``frontend/src/types/retryFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .operation import JobStatus


class RetryFeedItem(ContractModel):
    """One retried job projected from the authoritative retry ledger."""

    job_id: UUID
    project_id: UUID
    project_name: str
    operation_id: str
    status: JobStatus
    attempt: int = Field(ge=1)
    retries: int = Field(ge=1)
    retried_at: Timestamp


class RetryFeed(ContractModel):
    """A bounded, newest-first page of retried jobs with a whole-scope total.

    ``total`` counts every retried job in scope before paging. ``items`` holds at
    most ``limit`` entries in descending ``(retried_at, job_id)`` order.
    """

    items: list[RetryFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "RetryFeed",
    "RetryFeedItem",
]
