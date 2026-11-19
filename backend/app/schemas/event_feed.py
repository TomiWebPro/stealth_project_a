"""Authoritative job event feed contracts.

``GET /events/feed`` is a newest-first, workspace-wide view of job events derived
fresh from the authoritative ``JOB_EVENTS`` collection — the same store the SSE
and polling endpoints read and that ``GET /events/stats`` aggregates — so there
is no second index and no cached feed to drift. It complements
``GET /jobs/{id}/events`` (one job's chronological stream) and
``GET /events/stats`` (aggregates) by projecting every event across all jobs with
its joined job operation/project context.

An event carries no project or operation identity of its own, so each item is
joined to its parent job from the authoritative ``JOBS`` store. Events whose job
is missing are skipped (the same join rule ``/events/stats`` uses for project
scope), keeping the feed attributable. ``EventFeed`` carries a whole-scope
``total`` counted before the ``limit`` page is applied, so a UI can show both the
feed depth and a bounded page in a single call. Optional ``project_id`` and
``type`` filters narrow the same derivation; an unknown project uses the shared
404 envelope at the router.

Mirrored in ``frontend/src/types/eventFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .operation import JobError, JobEventType, JobStatus


class EventFeedItem(ContractModel):
    """One job event projected from the authoritative event store."""

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


class EventFeed(ContractModel):
    """A bounded, newest-first page of job events with a whole-scope total.

    ``total`` counts every event in scope before paging. ``items`` holds at most
    ``limit`` entries in descending ``(timestamp, job_id, seq)`` order.
    """

    items: list[EventFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "EventFeed",
    "EventFeedItem",
]
