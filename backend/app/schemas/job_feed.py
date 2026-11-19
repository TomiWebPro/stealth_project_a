"""Authoritative job feed contracts.

``GET /jobs/feed`` is a newest-first, workspace-wide view of jobs derived fresh
from the authoritative ``JOBS`` collection — the same store the submit/cancel/
retry/start transitions write — so there is no second index and no cached feed
to drift. It complements ``GET /jobs`` (a flat list) and ``GET /jobs/queue``
(only active jobs) by projecting every job with its joined project display name
and lifecycle timestamps.

``JobFeed`` carries a whole-scope ``total`` counted before the ``limit`` page is
applied, so a task panel can show both the feed depth and a bounded page in a
single call. An optional ``project_id`` scopes the same derivation to one
project; an optional ``status`` narrows it to one lifecycle state.

Mirrored in ``frontend/src/types/jobFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .operation import JobStatus


class JobFeedItem(ContractModel):
    """One job projected from the authoritative job store."""

    job_id: UUID
    project_id: UUID
    project_name: str
    operation_id: str
    status: JobStatus
    progress: float = Field(ge=0.0, le=1.0)
    attempt: int = Field(ge=1)
    created_by: UUID
    created_at: Timestamp
    started_at: Timestamp | None = None
    finished_at: Timestamp | None = None


class JobFeed(ContractModel):
    """A bounded, newest-first page of jobs with a whole-scope total.

    ``total`` counts every job in scope before paging. ``items`` holds at most
    ``limit`` entries in descending ``(created_at, job_id)`` order.
    """

    items: list[JobFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "JobFeed",
    "JobFeedItem",
]
