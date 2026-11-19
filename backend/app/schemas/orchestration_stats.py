"""Authoritative orchestration statistics contracts.

The orchestration stores (``ORCHESTRATION_PLANS`` and ``ORCHESTRATION_RUNS``)
record the deterministic local plans produced by the orchestration layer and the
runs that execute them. This snapshot reports how many plans/runs exist, how runs
are distributed across the canonical lifecycle stages, how much work is encoded
in them (plan steps and linked jobs), how activity is distributed per project and
how recent the newest plan/run is — so the UI never has to reproduce the
aggregation rules or read those collections directly.

Everything is computed fresh from the authoritative orchestration stores on every
call: there is no second index to drift. ``by_stage`` is zero-filled over every
canonical orchestration stage and ``by_project`` is sorted by descending plan
count, then run count, then project id for deterministic cross-backend ordering.
Runs carry a ``plan_id`` (not a project id), so per-project attribution joins each
run back to its plan. An optional ``project_id`` narrows the same derivation to
one project.

Mirrored in ``frontend/src/types/orchestrationStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .orchestration import OrchestrationStage


class OrchestrationStageCount(ContractModel):
    """Number of orchestration runs in one canonical lifecycle stage."""

    stage: OrchestrationStage
    count: int = Field(ge=0)


class OrchestrationProjectCount(ContractModel):
    """Plans and runs recorded for one project."""

    project_id: UUID
    plans: int = Field(ge=0)
    runs: int = Field(ge=0)


class OrchestrationStats(ContractModel):
    """Orchestration metrics derived from the authoritative plan/run stores.

    ``by_stage`` is zero-filled over every canonical orchestration stage so a UI
    can read a bucket without guarding for a missing key. ``by_project`` lists
    only projects with at least one plan or run, sorted by descending plan count
    then run count then project id. ``total_steps`` sums the steps of every plan
    in scope; ``total_jobs_linked`` sums the job ids attached to every run in
    scope. The two recency fields are ``None`` when the corresponding collection
    is empty.
    """

    total_plans: int = Field(ge=0)
    total_runs: int = Field(ge=0)
    total_steps: int = Field(ge=0)
    total_jobs_linked: int = Field(ge=0)
    by_stage: list[OrchestrationStageCount] = Field(default_factory=list)
    by_project: list[OrchestrationProjectCount] = Field(default_factory=list)
    newest_plan_at: Timestamp | None = None
    newest_run_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "OrchestrationProjectCount",
    "OrchestrationStageCount",
    "OrchestrationStats",
]
