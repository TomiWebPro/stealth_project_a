"""Authoritative single-retry overview contracts.

``GET /retries/stats`` exposes workspace retry metrics and ``GET /retries/feed`` a
newest-first feed of retried jobs, but neither shows one retried job with its
joined project context. This snapshot fills that gap: the job identity/lifecycle
fields (reusing the ``RetryFeedItem`` projection), a whole-project/whole-workspace
count block derived with the exact same rules as ``/retries/stats`` and a bounded
newest-first page of sibling retried jobs from the same project, reusing the
canonical ``RetryFeedItem`` wire shape.

Everything is computed fresh from the authoritative ``JOB_RETRIES`` idempotency
ledger joined to ``JOBS``/``PROJECTS`` on every call: there is no second index to
drift and removing the router leaves no collection behind. The ledger is
timestamp-free, so a job's ``retried_at`` is the most recent activity timestamp
(created/started/finished) of the joined job — the same recency signal the feed
and the stats snapshot use. Ledger entries whose job no longer exists (orphans)
are excluded, keeping the overview consistent with both existing retry views.
``counts`` describe whole scopes and are never bounded by ``recent_limit``; the
sibling page is bounded and newest-first with a deterministic
``(retried_at, job_id)`` tie-break.

An unknown job uses the shared 404 ``job_not_found`` envelope; a job with no
accepted retries uses the shared 404 ``retry_not_found`` envelope. Bounds
validation happens at the router (shared 422 envelope).

Mirrors ``frontend/src/types/retryOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .operation import JobStatus
from .retry_feed import RetryFeedItem


class RetryOverviewCounts(ContractModel):
    """Retry totals derived from the authoritative retry ledger."""

    project_retries: int = Field(ge=0)
    project_jobs: int = Field(ge=0)
    total_retries: int = Field(ge=0)


class RetryOverview(ContractModel):
    """A single retried-job snapshot: identity, context, counts and siblings.

    ``counts`` describe the target job's project and the whole workspace; they
    are never bounded by ``recent_limit``. ``recent_siblings`` is newest-first
    within the same project (the target included) and bounded by ``recent_limit``.
    """

    job_id: UUID
    project_id: UUID
    project_name: str
    operation_id: str
    status: JobStatus
    attempt: int = Field(ge=1)
    retries: int = Field(ge=1)
    retried_at: Timestamp
    counts: RetryOverviewCounts
    recent_siblings: list[RetryFeedItem] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["RetryOverview", "RetryOverviewCounts"]
