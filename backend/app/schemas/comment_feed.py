"""Authoritative comment-feed contracts.

``GET /comments/feed`` is a newest-first, workspace-wide view of collaboration
comments derived fresh from the authoritative ``COMMENTS`` collection — the same
store the ``GET|POST /comments`` router reads and writes and collaboration
statistics aggregates — so there is no second index and no cached feed to drift.
It complements ``GET /comments`` (a flat list) and ``GET /activity`` (a mixed
asset/publish/job/comment stream) by projecting every comment with its joined
project display name and author identity.

``CommentFeed`` carries a whole-scope ``total`` counted before the ``limit`` page
is applied, so a browser can show both the feed depth and a bounded page in a
single call. An optional ``project_id`` scopes the same derivation to one
project; an unknown project uses the shared 404 envelope at the router.

Mirrored in ``frontend/src/types/commentFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp


class CommentFeedItem(ContractModel):
    """One project comment projected from the authoritative comment store."""

    comment_id: UUID
    project_id: UUID
    project_name: str
    asset_id: UUID | None = None
    author_id: UUID
    body: str
    created_at: Timestamp


class CommentFeed(ContractModel):
    """A bounded, newest-first page of comments with a whole-scope total.

    ``total`` counts every comment in scope before paging. ``items`` holds at
    most ``limit`` entries in descending ``(created_at, comment_id)`` order.
    """

    items: list[CommentFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "CommentFeed",
    "CommentFeedItem",
]
