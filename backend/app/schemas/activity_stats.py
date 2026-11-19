"""Authoritative activity statistics contracts.

The workspace activity feed (``schemas/activity``) derives asset/publish/job/comment
events from the authoritative stores. This snapshot aggregates that same event
stream into metrics the UI can read without reproducing the derivation rules: how
many events exist, how they are distributed across the canonical activity kinds,
how many distinct people participate, how activity is distributed per project and
how recent the newest event is.

Everything is computed fresh from the authoritative event derivation on every
call: there is no second index to drift. ``by_kind`` is zero-filled over every
canonical activity kind and ``by_project`` is sorted by descending event count,
then project id for deterministic cross-backend ordering. An optional
``project_id`` narrows the same derivation to one project.

Mirrored in ``frontend/src/types/activityStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .activity import ActivityKind
from .common import ContractModel, Timestamp


class ActivityKindCount(ContractModel):
    """Number of activity events of one canonical kind."""

    kind: ActivityKind
    count: int = Field(ge=0)


class ActivityProjectCount(ContractModel):
    """Activity recorded for one project."""

    project_id: UUID
    events: int = Field(ge=0)
    participants: int = Field(ge=0)


class ActivityStats(ContractModel):
    """Activity metrics derived from the authoritative event stream.

    ``by_kind`` is zero-filled over every canonical activity kind so a UI can read
    a bucket without guarding for a missing key. ``by_project`` lists only projects
    with at least one event, sorted by descending event count then project id.
    ``total_participants`` counts distinct actors across every event in scope.
    ``newest_event_at`` is ``None`` when there are no events in scope.
    """

    total_events: int = Field(ge=0)
    total_participants: int = Field(ge=0)
    by_kind: list[ActivityKindCount] = Field(default_factory=list)
    by_project: list[ActivityProjectCount] = Field(default_factory=list)
    newest_event_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "ActivityKindCount",
    "ActivityProjectCount",
    "ActivityStats",
]
