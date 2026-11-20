"""Authoritative single collaboration-signal overview contracts.

The collaboration feed (``schemas/collaboration_feed``) derives newest-first
presence/comment signals from the authoritative ``PRESENCE`` and ``COMMENTS``
stores and ``GET /collaboration/stats`` aggregates those stores, but neither
offers a view of one individual signal with its joined project context. This
snapshot fills that gap: the signal identity/lifecycle fields (reusing the
canonical ``CollaborationFeedItem`` projection), a project-scoped count block
reusing the canonical ``PresenceStateCount`` buckets plus a workspace-wide
context total, and a bounded newest-first page of sibling signals from the same
project reusing the same canonical wire shape.

Everything is computed fresh from the authoritative collaboration feed derivation
on every call: there is no second index to drift and removing the router leaves no
collection behind. ``counts`` describe whole scopes and are never bounded by
``recent_limit``; the sibling page is bounded and newest-first with a
deterministic ``(occurred_at, signal_id, signal, project_id)`` tie-break.

A signal is addressed by a composite key ``<signal>:<project_id>:<signal_id>``.
Presence is keyed by project + acting user (so the signal id is the user id), while
a comment signal id is the comment id; the project component disambiguates a user
who is present in more than one project.

Mirrors ``frontend/src/types/collaborationOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .collaboration_feed import CollaborationFeedItem, CollaborationSignal
from .collaboration_stats import PresenceStateCount
from .common import ContractModel, Timestamp
from .orchestration import PresenceState


class CollaborationOverviewCounts(ContractModel):
    """Collaboration totals for one signal's project, plus workspace context."""

    project_signals: int = Field(ge=0)
    project_presence: int = Field(ge=0)
    project_comments: int = Field(ge=0)
    project_participants: int = Field(ge=0)
    workspace_signals: int = Field(ge=0)
    by_state: list[PresenceStateCount] = Field(default_factory=list)


class CollaborationOverview(ContractModel):
    """A single-collaboration-signal snapshot: identity, context, counts, siblings.

    ``counts`` are scoped to the viewed signal's project (``workspace_signals`` is
    the whole-workspace total) and are never bounded by ``recent_limit``.
    ``recent_signals`` is newest-first within that project and bounded by the page.
    """

    signal_id: UUID
    signal: CollaborationSignal
    project_id: UUID
    project_name: str
    actor_id: UUID
    state: PresenceState | None = None
    body: str | None = None
    asset_id: UUID | None = None
    occurred_at: Timestamp
    counts: CollaborationOverviewCounts
    recent_signals: list[CollaborationFeedItem] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["CollaborationOverview", "CollaborationOverviewCounts"]
