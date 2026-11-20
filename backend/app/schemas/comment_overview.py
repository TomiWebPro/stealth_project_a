"""Authoritative single-comment overview contracts.

A collaboration thread UI needs a compact snapshot of one comment: its identity
and project/asset context, the canonical reference category it belongs to, the
authoritative whole-project and same-thread comment activity, and a bounded
newest-first list of its thread siblings. Deriving it on the backend — where the
``COMMENTS`` store is authoritative — keeps every client reading the same
numbers without reimplementing the comment projection per screen.

Everything is computed fresh from the authoritative store on every call: there
is no second index to drift and removing the router leaves no collection behind.
``counts`` reuses the per-project semantics of ``/comments/stats`` (so the single
view cannot disagree with that snapshot) and ``recent_comments`` reuses the
canonical ``CommentFeedItem`` wire shape from ``/comments/feed``. Project display
names are joined from the authoritative ``PROJECTS`` store with a stable fallback.

Mirrors ``frontend/src/types/commentOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .comment_feed import CommentFeedItem
from .comment_stats import CommentReference
from .common import ContractModel, NonEmptyStr, Timestamp


class CommentOverviewCounts(ContractModel):
    """Whole-project and same-thread comment activity, never bounded by the page."""

    project_comments: int = Field(ge=0)
    project_authors: int = Field(ge=0)
    project_assets: int = Field(ge=0)
    thread_comments: int = Field(ge=0)


class CommentOverview(ContractModel):
    """A single-comment snapshot: identity, context, activity and thread siblings.

    ``reference`` is ``asset`` when the comment carries an ``asset_id`` and
    ``project`` for project-level comments. ``counts`` is never bounded by the
    ``recent_limit`` page; ``recent_comments`` is the newest-first list of other
    comments in the same thread (same project and same asset scope, including the
    target) bounded by that page. A comment whose project no longer exists keeps
    a stable ``Unknown project`` name rather than being dropped.
    """

    comment_id: UUID
    project_id: UUID
    project_name: NonEmptyStr
    asset_id: UUID | None = None
    author_id: UUID
    body: str
    created_at: Timestamp
    reference: CommentReference
    counts: CommentOverviewCounts
    recent_comments: list[CommentFeedItem] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["CommentOverview", "CommentOverviewCounts"]
