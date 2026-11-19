"""Authoritative comment-statistics contracts.

``GET /comments/stats`` is an aggregate snapshot derived fresh from the
authoritative ``COMMENTS`` collection — the same store the ``GET|POST /comments``
router writes and ``GET /comments/feed`` projects — so there is no second index
and no cached snapshot to drift. It complements ``GET /comments/feed`` (a
newest-first page) by reporting totals, zero-filled reference-category and
per-project/per-author breakdowns and newest-comment recency.

Everything is computed fresh from the authoritative store on every call.
``by_reference`` is zero-filled over the canonical reference categories so the
wire shape is identical across the in-memory and SQLite stores; ``by_project``
and ``by_author`` are sorted by descending comment count then id for
deterministic cross-backend ordering. An optional ``project_id`` narrows the
same derivation to one project.

Mirrored in ``frontend/src/types/commentStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp

# Single source for both the wire breakdown and the repository bucketing.
CommentReference = Literal["asset", "project"]


class CommentReferenceCount(ContractModel):
    """Number of comments in one canonical reference category."""

    reference: CommentReference
    count: int = Field(ge=0)


class CommentProjectCount(ContractModel):
    """Comment and distinct-author activity recorded for one project."""

    project_id: UUID
    comments: int = Field(ge=0)
    authors: int = Field(ge=0)


class CommentAuthorCount(ContractModel):
    """Number of comments authored by one user."""

    author_id: UUID
    comments: int = Field(ge=0)


class CommentStats(ContractModel):
    """Comment metrics derived from the authoritative comment store.

    ``by_reference`` is zero-filled over every canonical reference category so a
    UI can read a bucket without guarding for a missing key. ``by_project`` and
    ``by_author`` list only entities with at least one comment, sorted by
    descending comment count then id. ``newest_comment_at`` is ``None`` when the
    scope holds no comments.
    """

    total_comments: int = Field(ge=0)
    total_authors: int = Field(ge=0)
    total_projects: int = Field(ge=0)
    by_reference: list[CommentReferenceCount] = Field(default_factory=list)
    by_project: list[CommentProjectCount] = Field(default_factory=list)
    by_author: list[CommentAuthorCount] = Field(default_factory=list)
    newest_comment_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "CommentAuthorCount",
    "CommentProjectCount",
    "CommentReference",
    "CommentReferenceCount",
    "CommentStats",
]
