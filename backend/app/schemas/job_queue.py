"""Authoritative job dispatch-queue contracts.

``GET /jobs/queue`` is the operator view of what the backend is about to run:
the active (``queued`` + ``running``) jobs ordered oldest-first like a FIFO work
queue. It is derived directly from the authoritative ``JOBS`` collection — the
same store the submit/cancel/retry/start transitions write — so there is no
second index and no cached queue position to drift. Terminal jobs (succeeded /
failed / canceled) are intentionally excluded.

``JobQueueView`` carries whole-queue counts (``total`` / ``waiting`` /
``running``) over the full filtered set plus a bounded, position-labelled page
of entries, so a task panel can render both the queue depth and the next jobs
to dispatch in a single call. An optional ``project_id`` narrows the same
derivation to one project.

Mirrored in ``frontend/src/types/jobQueue.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .operation import JobStatus


class JobQueueEntry(ContractModel):
    """One active job in the dispatch queue, with its FIFO position."""

    position: int = Field(ge=1)
    job_id: UUID
    operation_id: str
    status: JobStatus
    project_id: UUID
    created_at: Timestamp


class JobQueueView(ContractModel):
    """A bounded view of the active job queue with whole-queue counters.

    ``total`` / ``waiting`` / ``running`` count every active job in scope before
    paging. ``entries`` holds at most ``limit`` jobs, positions included, in
    FIFO order. ``generated_at`` is the derivation timestamp.
    """

    total: int = Field(ge=0)
    waiting: int = Field(ge=0)
    running: int = Field(ge=0)
    entries: list[JobQueueEntry] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = [
    "JobQueueEntry",
    "JobQueueView",
]
