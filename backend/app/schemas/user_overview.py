"""Authoritative single-user overview contracts.

The collaboration/Workspaces UI needs a compact profile snapshot: identity,
organization memberships and whole-scope activity counts, plus a few recent
projects and comments authored by the user. Deriving it on the backend — where
users, memberships, projects, conversations, comments and presence are
authoritative — keeps every client reading the same numbers and avoids
reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative stores on every call: there
is no second index to drift and removing the router leaves no collection behind.
``memberships`` carries the joined organization name for each membership, and
``recent_projects``/``recent_comments`` are newest-first (deterministic id
tie-break) and bounded by ``recent_limit`` while counts describe the whole scope.
Mirrors ``frontend/src/types/userOverview.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .auth import MemberRole, Project
from .common import ContractModel, Email, NonEmptyStr, Timestamp
from .orchestration import Comment


class UserOverviewCounts(ContractModel):
    """Whole-scope totals for one user, derived authoritatively."""

    organizations: int = Field(ge=0)
    projects: int = Field(ge=0)
    conversations: int = Field(ge=0)
    comments: int = Field(ge=0)
    presence: int = Field(ge=0)


class UserMembership(ContractModel):
    """One organization membership with its joined display name and role."""

    org_id: UUID
    org_name: NonEmptyStr
    role: MemberRole
    joined_at: Timestamp


class UserOverview(ContractModel):
    """A single-user snapshot: identity, memberships and recent authored items.

    ``counts`` are never bounded by ``recent_limit``; ``memberships`` lists every
    organization the user belongs to, while ``recent_projects`` and
    ``recent_comments`` are newest-first pages bounded by that limit.
    """

    user_id: UUID
    email: Email
    display_name: NonEmptyStr
    avatar_url: str | None = None
    created_at: Timestamp
    counts: UserOverviewCounts
    memberships: list[UserMembership] = Field(default_factory=list)
    recent_projects: list[Project] = Field(default_factory=list)
    recent_comments: list[Comment] = Field(default_factory=list)
    generated_at: Timestamp


__all__ = ["UserOverview", "UserOverviewCounts", "UserMembership"]
