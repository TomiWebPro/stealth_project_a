"""Authoritative job retry statistics contracts.

Retry requests are recorded in the authoritative ``JOB_RETRIES`` idempotency
ledger (see ``repositories/jobs.py``): one entry per accepted retry, keyed by
``{job_id}:{idempotency_key}`` so repeated submissions collapse into a single
ledger entry. This snapshot reports how many retries were accepted, how many
distinct jobs were retried, how those jobs split across the canonical
``JobStatus`` values and how the retries distribute across projects.

Everything is computed fresh from the authoritative store on every call; there
is no second index. ``by_status`` is zero-filled over every canonical
``JobStatus`` in its documented order so a UI can read a bucket without
guarding for a missing key. ``by_project`` lists only projects with at least
one attributed retry and is sorted by descending retry count then project id
for deterministic cross-backend ordering. An optional ``project_id`` narrows
the same derivation to one project.

The ledger itself is timestamp-free, so ``newest_retry_at`` is the most recent
activity timestamp (created/started/finished) among the joined retried jobs and
is ``None`` when nothing was retried.

Mirrored in ``frontend/src/types/retryStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .operation import JobStatus


class RetryStatusCount(ContractModel):
    """Number of retried jobs currently in one lifecycle status."""

    status: JobStatus
    jobs: int = Field(ge=0)


class RetryProjectCount(ContractModel):
    """Retry activity recorded for one project."""

    project_id: UUID
    retries: int = Field(ge=0)
    jobs: int = Field(ge=0)


class RetryStats(ContractModel):
    """Job retry metrics derived from the authoritative retry ledger.

    ``by_status`` is zero-filled over every canonical job status; ``by_project``
    is ordered by descending retry count then project id so the wire shape is
    identical across storage backends. ``total_retries`` equals the sum of the
    ``by_project`` retry counts, and ``total_jobs`` the sum of their job counts.
    """

    total_retries: int = Field(ge=0)
    total_jobs: int = Field(ge=0)
    by_status: list[RetryStatusCount] = Field(default_factory=list)
    by_project: list[RetryProjectCount] = Field(default_factory=list)
    newest_retry_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "RetryProjectCount",
    "RetryStats",
    "RetryStatusCount",
]
