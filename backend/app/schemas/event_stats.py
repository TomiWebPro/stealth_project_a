"""Authoritative job event stream statistics contracts.

Job events live in the authoritative ``JOB_EVENTS`` collection (see
``repositories/jobs.py``). This snapshot reports the shape of that stream: how
many events exist, how many jobs produced them, how the events split across the
canonical ``JobEventType`` values, per-job activity with recency, the newest
event's timestamp and when the snapshot was generated.

Everything is computed fresh from the authoritative store on every call; there
is no second index to drift. ``by_type`` is zero-filled over every canonical
``JobEventType`` in its documented order so a UI can read a bucket without
guarding for a missing key. ``by_job`` lists only jobs that emitted at least one
event, sorted by descending event count then job id for deterministic cross-
backend ordering. An optional ``project_id`` narrows the same derivation to one
project by joining events to their parent jobs.

Mirrored in ``frontend/src/types/eventStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .operation import JobEventType


class EventTypeCount(ContractModel):
    """Number of job events of one canonical event type."""

    type: JobEventType
    count: int = Field(ge=0)


class EventJobCount(ContractModel):
    """Event activity recorded for one job."""

    job_id: UUID
    events: int = Field(ge=0)
    newest_event_at: Timestamp


class EventStats(ContractModel):
    """Job event metrics derived from the authoritative event store.

    ``by_type`` is zero-filled over every canonical event type. ``by_job`` is
    ordered by descending event count then job id so the wire shape is identical
    across storage backends. ``newest_event_at`` is ``None`` when there are no
    events in scope.
    """

    total_events: int = Field(ge=0)
    total_jobs: int = Field(ge=0)
    by_type: list[EventTypeCount] = Field(default_factory=list)
    by_job: list[EventJobCount] = Field(default_factory=list)
    newest_event_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "EventJobCount",
    "EventStats",
    "EventTypeCount",
]
