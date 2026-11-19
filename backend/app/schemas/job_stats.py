"""Authoritative job execution statistics contracts.

The task panel and workspace overview need aggregate execution metrics (status
breakdown, per-operation outcomes, success rate, throughput timing). Deriving
them on the backend — where jobs are authoritative — keeps every screen reading
the same numbers and avoids reproducing aggregation rules per client.

Everything is computed fresh from the job store on every call: there is no
second index to drift and removing the router leaves no collection behind.
An optional ``project_id`` scope narrows the same derivation to one project.

Mirrored in ``frontend/src/types/jobStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from pydantic import Field

from .common import ContractModel, NonEmptyStr, Timestamp
from .operation import JobStatus


class JobStatusCount(ContractModel):
    """Number of jobs currently in one lifecycle status."""

    status: JobStatus
    count: int = Field(ge=0)


class OperationJobStat(ContractModel):
    """Job totals and terminal outcomes for one operation id."""

    operation_id: NonEmptyStr
    total: int = Field(ge=0)
    succeeded: int = Field(ge=0)
    failed: int = Field(ge=0)


class JobStats(ContractModel):
    """Execution metrics derived from the authoritative job store.

    ``by_status`` is zero-filled over every lifecycle status so a UI can read
    ``by_status[status]`` without guarding for a missing key. ``success_rate`` is
    ``succeeded / (succeeded + failed)`` over *terminal* attempts (canceled and
    in-flight jobs are excluded from that ratio); it is ``0.0`` when there are no
    terminal attempts. ``in_flight`` counts queued + running jobs and
    ``completed`` counts succeeded + failed + canceled jobs.
    ``average_duration_seconds`` is the mean wall-clock duration (finished_at -
    started_at) over jobs that have both timestamps, rounded to 3 decimals, and
    is ``None`` when no job has completed with timing.
    """

    total: int = Field(ge=0)
    by_status: list[JobStatusCount] = Field(default_factory=list)
    by_operation: list[OperationJobStat] = Field(default_factory=list)
    success_rate: float = Field(ge=0.0, le=1.0, default=0.0)
    in_flight: int = Field(ge=0)
    completed: int = Field(ge=0)
    average_duration_seconds: float | None = None
    generated_at: Timestamp


__all__ = ["JobStats", "JobStatusCount", "OperationJobStat"]
