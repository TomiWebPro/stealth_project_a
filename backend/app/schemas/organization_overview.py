"""Authoritative single-organization overview contracts.

The Workspaces UI needs a compact, single-organization snapshot: identity,
membership totals with a zero-filled role breakdown, and a few recent
members/projects. Deriving it on the backend — where users, organizations,
memberships and projects are authoritative — keeps every client reading the same
numbers and avoids reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative auth/project stores on every
call: there is no second index to drift and removing the router leaves no
collection behind. ``by_role`` is zero-filled over every canonical member role;
``recent_members`` and ``recent_projects`` are newest-first and bounded by
``recent_limit`` while counts always describe the whole scope. Mirrors
``frontend/src/types/organizationOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .auth import Member, Project
from .common import ContractModel, NonEmptyStr, Timestamp
from .organization_stats import RoleMemberCount


class OrganizationOverviewCounts(ContractModel):
    """Whole-scope totals for one organization, derived authoritatively."""

    members: int = Field(ge=0)
    projects: int = Field(ge=0)


class OrganizationOverview(ContractModel):
    """A single-organization snapshot: identity, membership and recent items.

    ``by_role`` is zero-filled over the canonical member-role order and its member
    counts sum to ``counts.members``. ``recent_members`` and ``recent_projects``
    are newest-first (deterministic id tie-break) and bounded by ``recent_limit``;
    the counts are never bounded by that page.
    """

    org_id: UUID
    name: NonEmptyStr
    slug: str
    created_at: Timestamp
    counts: OrganizationOverviewCounts
    by_role: list[RoleMemberCount] = Field(default_factory=list)
    recent_members: list[Member] = Field(default_factory=list)
    recent_projects: list[Project] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["OrganizationOverview", "OrganizationOverviewCounts"]
