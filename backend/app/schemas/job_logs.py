"""Authoritative per-job execution log contracts.

A job's human-readable log is derived from the authoritative ``JOB_EVENTS``
collection (the same stream the SSE/polling endpoints read), so there is no
second source of truth to drift. Each event is projected onto a log entry with
a coarse ``level`` that a console can filter and colour-code:

    error -> "error", result -> "success", progress -> "debug",
    status/intermediate/log -> "info".

``JobLogFrame`` carries a resume cursor (``next_seq``) and the total number of
matching entries across the whole stream (before paging) so a UI can render a
log console with pagination without a second query.

Mirrored in ``frontend/src/types/jobLogs.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .operation import JobError, JobEventType, JobStatus

# Coarse console severity derived from an event's type. Kept as a contract so
# the frontend filter and the backend derivation cannot drift.
LogLevel = Literal["debug", "info", "success", "error"]


class JobLogEntry(ContractModel):
    """One event from a job's execution stream, projected as a log line."""

    seq: int = Field(ge=0)
    type: JobEventType
    level: LogLevel
    message: str | None = None
    status: JobStatus | None = None
    progress: float | None = Field(default=None, ge=0.0, le=1.0)
    asset_id: UUID | None = None
    error: JobError | None = None
    timestamp: Timestamp


class JobLogFrame(ContractModel):
    """A filtered, paginated slice of a job's log with a resume cursor."""

    job_id: UUID
    entries: list[JobLogEntry] = Field(default_factory=list)
    next_seq: int = Field(ge=0, default=0)
    total: int = Field(ge=0, default=0)


__all__ = [
    "JobLogEntry",
    "JobLogFrame",
    "LogLevel",
]
