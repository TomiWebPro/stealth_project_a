"""Authoritative organization-feed contracts.

``GET /orgs/feed`` is a newest-first, workspace-wide view of organizations derived
fresh from the authoritative ``ORGANIZATIONS`` collection — the same store
``AuthRepository`` writes and ``OrganizationStatsRepository`` aggregates — so
there is no second index and no cached feed to drift. It complements
``GET /orgs/stats`` (an aggregate snapshot) by projecting every individual
organization with member/project activity counts joined from the authoritative
``MEMBERS`` / ``PROJECTS`` stores.

Ordering is by descending ``(created_at, org_id)`` so the newest organization
comes first and ties are broken deterministically across the in-memory and SQLite
adapters. ``OrganizationFeed`` carries a whole-scope ``total`` counted before the
``limit`` page is applied, so a browser can show both the feed depth and a bounded
page in a single call. An invalid ``limit`` uses the shared 422 envelope at the
router.

Mirrored in ``frontend/src/types/organizationFeed.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ContractModel, Timestamp


class OrganizationFeedItem(ContractModel):
    """One organization projected from the authoritative store with activity counts."""

    org_id: UUID
    name: str
    slug: str
    member_count: int = Field(ge=0)
    project_count: int = Field(ge=0)
    created_at: Timestamp


class OrganizationFeed(ContractModel):
    """A bounded, newest-first page of organizations with a whole-scope total.

    ``total`` counts every organization before paging. ``items`` holds at most
    ``limit`` entries in descending ``(created_at, org_id)`` order.
    """

    items: list[OrganizationFeedItem] = Field(default_factory=list)
    total: int = Field(ge=0)
    generated_at: Timestamp


__all__ = [
    "OrganizationFeed",
    "OrganizationFeedItem",
]
