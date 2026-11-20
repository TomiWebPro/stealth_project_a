"""Authoritative single job-event overview contracts.

A job's event stream is already exposed chronologically (``GET /jobs/{id}/events``)
and as aggregates (``GET /events/stats``), but there is no view of one individual
event with its joined job/project context. This snapshot fills that gap: the
event identity/lifecycle fields, the operation/project identity joined from the
authoritative job store, a whole-job ``by_type`` breakdown (zero-filled over the
canonical ``JobEventType`` values) and a bounded newest-first page of sibling
events from the same job.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
The ``by_type`` buckets reuse ``EventTypeCount`` from ``/events/stats`` and the
project-name fallback reuses the rule from ``/events/feed``, so the overview
cannot disagree with those views. ``counts`` describe the whole job and are
never bounded by ``recent_limit``; the sibling page is bounded and newest-first
with a deterministic ``(timestamp, seq)`` tie-break.

Mirrors ``frontend/src/types/eventOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .event_stats import EventTypeCount
from .operation import JobError, JobEvent, JobEventType, JobStatus


class EventOverviewCounts(ContractModel):
    """Whole-job event totals, derived from the authoritative event store."""

    total: int = Field(ge=0)
    by_type: list[EventTypeCount] = Field(default_factory=list)


class EventOverview(ContractModel):
    """A single-event snapshot: identity, context, counts and recent siblings.

    ``seq`` is the event's position within its parent job's stream. ``counts`` is
    zero-filled over the canonical event-type values and ``total`` counts every
    event emitted by the job. ``recent_siblings`` is newest-first and bounded by
    ``recent_limit``; the counts are never bounded by that page.
    """

    job_id: UUID
    seq: int = Field(ge=0)
    type: JobEventType
    operation_id: str
    project_id: UUID
    project_name: str
    status: JobStatus | None = None
    progress: float | None = Field(default=None, ge=0.0, le=1.0)
    message: str | None = None
    asset_id: UUID | None = None
    error: JobError | None = None
    timestamp: Timestamp
    counts: EventOverviewCounts
    recent_siblings: list[JobEvent] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["EventOverview", "EventOverviewCounts"]
