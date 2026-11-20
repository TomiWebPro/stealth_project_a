"""Authoritative single-orchestration-plan overview contracts.

The orchestration plan detail UI needs a compact, single-plan snapshot: identity,
whole-scope work totals, a zero-filled run-stage breakdown and a few recent runs.
Deriving it on the backend — where the plan/run stores and projects are
authoritative — keeps every client reading the same numbers and avoids
reproducing the projection per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
``counts`` and ``by_stage`` describe the whole plan while ``recent_runs`` is
newest-first and bounded by ``recent_limit``. The stage breakdown reuses the
canonical ``OrchestrationStage``/``OrchestrationStageCount`` contracts from
``/orchestration/stats`` so the two views cannot drift. Mirrors
``frontend/src/types/planOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .orchestration import OrchestrationStage
from .orchestration_stats import OrchestrationStageCount


class PlanOverviewCounts(ContractModel):
    """Whole-scope totals for one orchestration plan, derived authoritatively."""

    steps: int = Field(ge=0)
    runs: int = Field(ge=0)
    jobs_linked: int = Field(ge=0)


class PlanOverviewRunRef(ContractModel):
    """A run executing a plan, projected from the authoritative run store."""

    run_id: UUID
    stage: OrchestrationStage
    job_count: int = Field(ge=0)
    created_at: Timestamp


class PlanOverview(ContractModel):
    """A single-plan snapshot: identity, counts, stage coverage and recent runs.

    ``counts`` and ``by_stage`` are never bounded by ``recent_limit``;
    ``recent_runs`` is newest-first (deterministic id tie-break) and bounded by
    it. ``project_name`` falls back to a stable name when the project is missing
    so the overview is never dropped. ``goal`` is nullable for plans created
    without an explicit goal.
    """

    plan_id: UUID
    project_id: UUID
    project_name: str
    goal: str | None = None
    created_at: Timestamp
    counts: PlanOverviewCounts
    by_stage: list[OrchestrationStageCount] = Field(default_factory=list)
    recent_runs: list[PlanOverviewRunRef] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = [
    "PlanOverview",
    "PlanOverviewCounts",
    "PlanOverviewRunRef",
]
