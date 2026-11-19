"""Authoritative orchestration-feed contracts.

``GET /orchestration/feed`` is a newest-first, workspace-wide view of the plans
and runs recorded by the orchestration layer, derived fresh from the authoritative
``ORCHESTRATION_PLANS`` and ``ORCHESTRATION_RUNS`` stores — the same stores the
``GET|POST /orchestration/*`` routers write and ``GET /orchestration/stats``
aggregates — so there is no second index and no cached feed to drift. It
complements the aggregate snapshot by projecting every plan and run with its
joined project display name, lifecycle fields and work counts.

Every item is attributed to a project: a plan carries ``project_id`` directly,
while a run carries only a ``plan_id`` and is joined back to its plan for project
attribution (runs whose plan is missing are excluded, matching the stats
project-scope join). ``OrchestrationFeed`` carries a whole-scope ``total`` counted
before the ``limit`` page is applied. Optional ``project_id`` and ``kind`` filters
scope the same derivation; an unknown project uses the shared 404 envelope at the
router and an invalid kind/limit uses the shared 422 envelope.

Mirrored in ``frontend/src/types/orchestrationFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .orchestration import OrchestrationStage

OrchestrationFeedKind = Literal["plan", "run"]


class OrchestrationFeedItem(ContractModel):
    """One plan or run projected from the authoritative orchestration stores."""

    id: UUID
    kind: OrchestrationFeedKind
    plan_id: UUID
    run_id: UUID | None = None
    project_id: UUID
    project_name: str
    goal: str | None = None
    stage: OrchestrationStage | None = None
    step_count: int = Field(ge=0)
    job_count: int = Field(ge=0)
    created_at: Timestamp


class OrchestrationFeed(ContractModel):
    """A bounded, newest-first page of orchestration activity with a total.

    ``total`` counts every plan/attributed-run in scope before paging. ``items``
    holds at most ``limit`` entries in descending ``(created_at, kind, id)`` order.
    """

    items: list[OrchestrationFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "OrchestrationFeed",
    "OrchestrationFeedItem",
    "OrchestrationFeedKind",
]
