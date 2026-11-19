"""Authoritative collaboration statistics contracts.

The collaboration stores (``PRESENCE`` and ``COMMENTS``) record who is present in
each project and the discussion attached to projects/assets. This snapshot
reports how many presence/comment records exist, how presence is distributed
across the canonical states, how many distinct people participate, how activity
is distributed per project and how recent the newest signal is — so the UI never
has to reproduce the aggregation rules or read those collections directly.

Everything is computed fresh from the authoritative collaboration stores on every
call: there is no second index to drift. ``by_state`` is zero-filled over every
canonical presence state and ``by_project`` is sorted by descending comment
count, then presence count, then project id for deterministic cross-backend
ordering. An optional ``project_id`` narrows the same derivation to one project.

Mirrored in ``frontend/src/types/collaborationStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .orchestration import PresenceState


class PresenceStateCount(ContractModel):
    """Number of presence records in one canonical state."""

    state: PresenceState
    count: int = Field(ge=0)


class CollaborationProjectCount(ContractModel):
    """Presence and comment activity recorded for one project."""

    project_id: UUID
    comments: int = Field(ge=0)
    presence: int = Field(ge=0)


class CollaborationStats(ContractModel):
    """Collaboration metrics derived from the authoritative presence/comment stores.

    ``by_state`` is zero-filled over every canonical presence state so a UI can
    read a bucket without guarding for a missing key. ``by_project`` lists only
    projects with at least one presence or comment record, sorted by descending
    comment count then presence count then project id. ``total_participants``
    counts distinct users that are present or have authored a comment. The two
    recency fields are ``None`` when the corresponding collection is empty.
    """

    total_presence: int = Field(ge=0)
    total_comments: int = Field(ge=0)
    total_participants: int = Field(ge=0)
    by_state: list[PresenceStateCount] = Field(default_factory=list)
    by_project: list[CollaborationProjectCount] = Field(default_factory=list)
    newest_presence_at: Timestamp | None = None
    newest_comment_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "CollaborationProjectCount",
    "CollaborationStats",
    "PresenceStateCount",
]
