"""Authoritative single-membership overview contracts.

The collaboration/Workspaces UI needs a compact snapshot of one user's
membership in one organization: the joined org/user identity, the membership
role and join date, whole-scope activity counts scoped to that org, and a few
recent projects/comments. Deriving it on the backend — where users, memberships,
projects, conversations, comments and presence are authoritative — keeps every
client reading the same numbers and avoids reproducing aggregation rules per
screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
Membership is read from the ``MEMBERS`` collection with ``_org_id`` scoping, so
role/join data cannot disagree with ``GET /orgs/{id}/members``. ``counts``
describe the whole scope and are never bounded by ``recent_limit``; the two
recent pages are newest-first with a deterministic id tie-break.

Mirrors ``frontend/src/types/membershipOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .auth import MemberRole, Project
from .common import ContractModel, Email, NonEmptyStr, Timestamp
from .orchestration import Comment


class MembershipOverviewCounts(ContractModel):
    """Whole-scope totals for one membership, derived authoritatively."""

    projects: int = Field(ge=0)
    conversations: int = Field(ge=0)
    comments: int = Field(ge=0)
    presence: int = Field(ge=0)


class MembershipOverview(ContractModel):
    """A single-membership snapshot: joined identity, role and recent activity.

    ``counts`` are never bounded by ``recent_limit``; ``recent_projects`` and
    ``recent_comments`` are newest-first pages bounded by that limit.
    """

    org_id: UUID
    org_name: NonEmptyStr
    org_slug: str
    user_id: UUID
    email: Email
    display_name: NonEmptyStr
    avatar_url: str | None = None
    role: MemberRole
    joined_at: Timestamp
    counts: MembershipOverviewCounts
    recent_projects: list[Project] = Field(default_factory=list)
    recent_comments: list[Comment] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["MembershipOverview", "MembershipOverviewCounts"]
