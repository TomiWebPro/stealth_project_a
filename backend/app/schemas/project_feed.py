"""Authoritative project feed contracts.

``GET /projects/feed`` is a newest-first, workspace-wide view of projects derived
fresh from the authoritative ``PROJECTS`` collection — the same store the
projects router writes and project statistics aggregates — so there is no second
index and no cached feed to drift. It complements ``GET /projects`` (a flat list)
and ``GET /projects/stats`` (aggregate metrics) by projecting every project with
its joined organization display name and a canonical lifecycle label.

``ProjectFeed`` carries a whole-scope ``total`` counted before the ``limit`` page
is applied, so a browser can show both the feed depth and a bounded page in a
single call. An optional ``org_id`` scopes the same derivation to one
organization (matching ``GET /projects?org_id=``); an optional ``lifecycle``
narrows it to active or archived projects.

Mirrored in ``frontend/src/types/projectFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp
from .project_stats import ProjectLifecycle


class ProjectFeedItem(ContractModel):
    """One project projected from the authoritative project store."""

    project_id: UUID
    org_id: UUID
    org_name: str
    name: str
    description: str | None = None
    lifecycle: ProjectLifecycle
    created_by: UUID
    created_at: Timestamp
    updated_at: Timestamp


class ProjectFeed(ContractModel):
    """A bounded, newest-first page of projects with a whole-scope total.

    ``total`` counts every project in scope before paging. ``items`` holds at
    most ``limit`` entries in descending ``(created_at, project_id)`` order.
    """

    items: list[ProjectFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "ProjectFeed",
    "ProjectFeedItem",
]
