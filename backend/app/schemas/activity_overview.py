"""Authoritative single activity event overview contracts.

The workspace activity feed (``schemas/activity``) derives asset/publish/job/comment
events from the authoritative stores and ``GET /activity/stats`` aggregates that
stream, but neither offers a view of one individual event with its joined project
context. This snapshot fills that gap: the event identity/lifecycle fields, a joined
project name with an "Unknown project" fallback, a project-scoped count block
reusing the canonical ``ActivityKindCount`` buckets plus a workspace-wide context
total, and a bounded newest-first page of sibling events from the same project
reusing the canonical ``ActivityEvent`` wire shape.

Everything is computed fresh from the authoritative event derivation on every
call: there is no second index to drift and removing the router leaves no
collection behind. The ``by_kind`` buckets and totals use the exact same derivation
as ``/activity/stats`` (scoped to the event's project), so the overview cannot
disagree with that snapshot. ``counts`` describe whole scopes and are never bounded
by ``recent_limit``; the sibling page is bounded and newest-first with a
deterministic ``(timestamp, id)`` tie-break.

Mirrors ``frontend/src/types/activityOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .activity import ActivityEvent, ActivityKind, ActivityTone
from .activity_stats import ActivityKindCount
from .common import ContractModel, NonEmptyStr, Timestamp


class ActivityOverviewCounts(ContractModel):
    """Activity totals for one event's project, plus workspace context."""

    total_events: int = Field(ge=0)
    total_participants: int = Field(ge=0)
    workspace_events: int = Field(ge=0)
    by_kind: list[ActivityKindCount] = Field(default_factory=list)


class ActivityOverview(ContractModel):
    """A single-activity snapshot: identity, context, counts and recent siblings.

    ``counts`` are scoped to the viewed event's project (``workspace_events`` is the
    whole-workspace total) and are never bounded by ``recent_limit``.
    ``recent_events`` is newest-first within that project and bounded by the page.
    """

    id: NonEmptyStr
    kind: ActivityKind
    project_id: UUID
    project_name: str
    actor_id: UUID
    label: NonEmptyStr
    detail: NonEmptyStr
    timestamp: Timestamp
    tone: ActivityTone
    counts: ActivityOverviewCounts
    recent_events: list[ActivityEvent] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["ActivityOverview", "ActivityOverviewCounts"]
