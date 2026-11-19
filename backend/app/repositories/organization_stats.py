"""Authoritative organization/membership statistics repository.

Statistics are derived from the authoritative auth document collections on every
call, like ``ProjectStatsRepository`` and ``DashboardRepository``: there is no
second index to drift and removing the router leaves no collection behind.

``by_role`` is zero-filled over the canonical member-role order so the wire shape
is stable across the in-memory and SQLite stores. ``by_organization`` is sorted
by descending member count then organization id for deterministic cross-backend
ordering. An optional ``org_id`` narrows organizations and their members to one
organization, matching the ``GET /orgs`` / ``GET /projects?org_id=`` filters; an
unknown ``org_id`` simply yields a zero-filled breakdown.

Mirrors ``frontend/src/types/organizationStats.ts`` contracts.
"""

from __future__ import annotations

from typing import get_args
from uuid import UUID

from ..schemas.auth import Member, MemberRole, Organization, User
from ..schemas.common import utcnow
from ..schemas.organization_stats import (
    OrganizationMemberCount,
    OrganizationStats,
    RoleMemberCount,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

_ROLES = tuple(get_args(MemberRole))


class OrganizationStatsRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def stats(self, *, org_id: UUID | None = None) -> OrganizationStats:
        """Build fresh membership metrics, optionally scoped to an org."""
        organizations = [
            org
            for org in self._load_all(Collections.ORGANIZATIONS, Organization)
            if org_id is None or org.id == org_id
        ]
        org_ids = {org.id for org in organizations}

        # Membership documents carry an extra `_org_id` discriminator; rebuild
        # them into `Member` models exactly as AuthRepository.list_members does.
        member_records: list[tuple[UUID, Member]] = []
        for document in self.store.all(Collections.MEMBERS):
            raw_org_id = document.get("_org_id")
            if raw_org_id is None:
                continue
            try:
                member_org_id = UUID(str(raw_org_id))
            except ValueError:
                continue
            if member_org_id not in org_ids:
                continue
            member_records.append(
                (
                    member_org_id,
                    Member.model_validate(
                        {key: value for key, value in document.items() if key != "_org_id"}
                    ),
                )
            )

        role_counts = {role: 0 for role in _ROLES}
        org_counts = {org.id: 0 for org in organizations}
        for member_org_id, member in member_records:
            role_counts[member.role] = role_counts.get(member.role, 0) + 1
            org_counts[member_org_id] = org_counts.get(member_org_id, 0) + 1

        by_role = [
            RoleMemberCount(role=role, members=role_counts.get(role, 0))
            for role in _ROLES
        ]
        by_organization = [
            OrganizationMemberCount(org_id=current_org_id, members=count)
            for current_org_id, count in sorted(
                org_counts.items(), key=lambda item: (-item[1], str(item[0]))
            )
        ]

        total_organizations = len(organizations)
        total_members = len(member_records)
        average = round(total_members / total_organizations, 3) if total_organizations else 0.0
        newest = max(
            organizations,
            key=lambda org: (org.created_at, str(org.id)),
            default=None,
        )

        return OrganizationStats(
            total_organizations=total_organizations,
            total_members=total_members,
            total_users=len(self._load_all(Collections.USERS, User)),
            by_role=by_role,
            by_organization=by_organization,
            average_members_per_org=average,
            newest_org_at=newest.created_at if newest else None,
            generated_at=self.clock(),
        )


__all__ = ["OrganizationStatsRepository"]
