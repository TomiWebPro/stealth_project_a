"""Authoritative organization/membership statistics contracts.

The Workspaces screen and organization management need aggregate membership
metrics (organization/member/user totals, per-role and per-organization
breakdowns, recency) that agree with what ``GET /orgs`` and
``GET /orgs/{id}/members`` report. Deriving them on the backend — where users,
organizations and memberships are authoritative — keeps every client reading
the same numbers and avoids reproducing aggregation rules per screen.

Everything is computed fresh from the authoritative auth store on every call:
there is no second index to drift. ``by_role`` is zero-filled over every
canonical member role and ``by_organization`` is sorted by descending member
count then organization id for deterministic cross-backend ordering. An
optional ``org_id`` narrows the same derivation to one organization, matching
the ``GET /orgs?`` / ``GET /projects?org_id=`` filters.

Mirrored in ``frontend/src/types/organizationStats.ts`` — parity is enforced by
``backend/tests/test_contract_parity.py``.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .auth import MemberRole
from .common import ContractModel, Timestamp


class RoleMemberCount(ContractModel):
    """Number of members holding one role across the scoped organizations."""

    role: MemberRole
    members: int = Field(ge=0)


class OrganizationMemberCount(ContractModel):
    """Member count for one organization, derived from the membership store."""

    org_id: UUID
    members: int = Field(ge=0)


class OrganizationStats(ContractModel):
    """Workspace/membership metrics derived from the authoritative auth store.

    ``by_role`` is zero-filled over every canonical member role so a UI can read
    a bucket without guarding for a missing key. ``by_organization`` lists only
    organizations that exist in the store, sorted by descending member count then
    organization id. ``total_users`` counts registered users globally (it does
    not depend on the ``org_id`` scope). ``average_members_per_org`` divides
    ``total_members`` by ``total_organizations`` and is ``0.0`` when there are no
    organizations. ``newest_org_at`` is the newest organization's ``created_at``
    (``None`` when there are no organizations).
    """

    total_organizations: int = Field(ge=0)
    total_members: int = Field(ge=0)
    total_users: int = Field(ge=0)
    by_role: list[RoleMemberCount] = Field(default_factory=list)
    by_organization: list[OrganizationMemberCount] = Field(default_factory=list)
    average_members_per_org: float = Field(ge=0.0, default=0.0)
    newest_org_at: Timestamp | None = None
    generated_at: Timestamp


__all__ = [
    "OrganizationMemberCount",
    "OrganizationStats",
    "RoleMemberCount",
]
