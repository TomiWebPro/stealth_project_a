"""Authoritative collaboration-feed contracts.

``GET /collaboration/feed`` is a newest-first, workspace-wide view of the latest
collaboration signals derived fresh from the authoritative ``PRESENCE`` and
``COMMENTS`` collections — the same stores ``GET|POST /presence`` and
``GET|POST /comments`` write and ``GET /collaboration/stats`` aggregates — so there
is no second index and no cached feed to drift. It complements
``GET /collaboration/stats`` (an aggregate snapshot) by projecting each signal
with its joined project display name and actor identity.

A presence signal carries its canonical ``state`` and ``last_seen_at``; a comment
signal carries its ``body``, optional ``asset_id`` and ``created_at``. Both are
projected onto one ``CollaborationFeedItem`` shape with a coarse ``signal`` kind
and a unified ``occurred_at`` recency used for ordering. ``signal_id`` is the
comment id for comments and the acting user id for presence (presence is keyed by
project + user), and ordering breaks ties deterministically across the in-memory
and SQLite adapters.

``CollaborationFeed`` carries a whole-scope ``total`` counted before the ``limit``
page is applied, so a browser can show both the feed depth and a bounded page in
one call. Optional ``project_id`` and ``signal`` filters narrow the same
derivation; an unknown project uses the shared 404 envelope and a malformed id,
invalid signal or out-of-range limit uses the shared 422 envelope at the router.

Mirrored in ``frontend/src/types/collaborationFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .orchestration import PresenceState

# Single source for both the wire signal kind and the repository bucketing.
CollaborationSignal = Literal["presence", "comment"]


class CollaborationFeedItem(ContractModel):
    """One collaboration signal projected from the authoritative stores."""

    signal_id: UUID
    signal: CollaborationSignal
    project_id: UUID
    project_name: str
    actor_id: UUID
    state: PresenceState | None = None
    body: str | None = None
    asset_id: UUID | None = None
    occurred_at: Timestamp


class CollaborationFeed(ContractModel):
    """A bounded, newest-first page of collaboration signals with a whole-scope total.

    ``total`` counts every signal in scope before paging. ``items`` holds at most
    ``limit`` entries in descending ``(occurred_at, signal_id, signal, project_id)``
    order.
    """

    items: list[CollaborationFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "CollaborationFeed",
    "CollaborationFeedItem",
    "CollaborationSignal",
]
