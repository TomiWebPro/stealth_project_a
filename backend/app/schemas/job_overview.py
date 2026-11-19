"""Authoritative single-job overview contracts.

The Jobs UI needs a compact, single-job snapshot (identity + terminal state,
event/retry totals and a few recent events). Deriving it on the backend — where
jobs, their event stream and their retry ledger are authoritative — keeps every
client reading the same numbers and avoids reproducing aggregation rules per
screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
The ``by_event_type`` buckets reuse ``EventTypeCount`` from ``/events/stats`` so
the overview cannot disagree with the stream aggregate, and the recent events
reuse the ``JobEvent`` wire contract from the SSE/polling endpoints.
Mirrors ``frontend/src/types/jobOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, NonEmptyStr, SemVer, Timestamp
from .event_stats import EventTypeCount
from .operation import JobError, JobEvent, JobResult, JobStatus


class JobOverviewCounts(ContractModel):
    """Event/retry totals for one job, derived from the authoritative stores."""

    events: int = Field(ge=0)
    retries: int = Field(ge=0)
    by_event_type: list[EventTypeCount] = Field(default_factory=list)


class JobOverview(ContractModel):
    """A single-job snapshot: identity, counts and a few recent events.

    ``counts.events`` counts every event the job emitted and ``counts.retries``
    every accepted retry in the idempotency ledger; ``by_event_type`` is
    zero-filled over the canonical event types. ``recent_events`` is newest-first
    and bounded by ``recent_limit``; the totals are never bounded by that page.
    """

    job_id: UUID
    project_id: UUID
    project_name: str
    operation_id: NonEmptyStr
    schema_version: SemVer
    status: JobStatus
    progress: float = Field(ge=0.0, le=1.0)
    attempt: int = Field(ge=1)
    created_by: UUID
    created_at: Timestamp
    started_at: Timestamp | None = None
    finished_at: Timestamp | None = None
    result: JobResult | None = None
    error: JobError | None = None
    counts: JobOverviewCounts
    recent_events: list[JobEvent] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["JobOverview", "JobOverviewCounts"]
