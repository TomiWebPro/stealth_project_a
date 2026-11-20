"""Authoritative single-orchestration-run overview contracts.

The orchestration run detail UI needs a compact, single-run snapshot: identity,
the joined plan/project context, whole-scope job counters, a zero-filled job
status breakdown and a few recent linked jobs. Deriving it on the backend — where
the run/plan/job stores and projects are authoritative — keeps every client
reading the same numbers and avoids reproducing the projection per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
``counts`` and ``by_status`` describe the whole run while ``recent_jobs`` is
newest-first and bounded by ``recent_limit``. The status breakdown reuses the
canonical ``JobStatus``/``JobStatusCount`` contracts from ``/jobs/stats`` so the
two views cannot drift. Mirrors ``frontend/src/types/runOverview.ts`` — parity is
enforced by ``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, NonEmptyStr, Timestamp
from .job_stats import JobStatusCount
from .operation import JobStatus
from .orchestration import OrchestrationStage


class RunOverviewCounts(ContractModel):
    """Whole-scope totals for one orchestration run, derived authoritatively."""

    jobs_linked: int = Field(ge=0)
    jobs_resolved: int = Field(ge=0)
    plan_steps: int = Field(ge=0)


class RunOverviewJobRef(ContractModel):
    """A job linked from a run, resolved from the authoritative job store."""

    job_id: UUID
    operation_id: NonEmptyStr
    status: JobStatus
    progress: float = Field(ge=0.0, le=1.0, default=0.0)
    created_at: Timestamp


class RunOverview(ContractModel):
    """A single-run snapshot: identity, joined context, counts and recent jobs.

    ``counts`` and ``by_status`` are never bounded by ``recent_limit``;
    ``recent_jobs`` is newest-first (deterministic id tie-break) and bounded by
    it. ``project_id``/``plan_goal`` are ``None`` for a run whose plan is missing
    and ``project_name`` falls back to a stable name, so an orphan run is never
    dropped from the overview.
    """

    run_id: UUID
    plan_id: UUID
    project_id: UUID | None = None
    project_name: str
    plan_goal: str | None = None
    stage: OrchestrationStage
    created_at: Timestamp
    counts: RunOverviewCounts
    by_status: list[JobStatusCount] = Field(default_factory=list)
    recent_jobs: list[RunOverviewJobRef] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = [
    "RunOverview",
    "RunOverviewCounts",
    "RunOverviewJobRef",
]
