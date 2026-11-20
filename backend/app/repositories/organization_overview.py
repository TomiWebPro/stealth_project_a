"""Authoritative single-organization overview repository.

The snapshot is derived fresh from the authoritative auth/project stores on every
call, like ``OrganizationStatsRepository`` and ``ProjectOverviewRepository``:
there is no second index to drift and removing the router leaves no collection
behind. Membership is read through ``AuthRepository.list_members`` so role and
identity data cannot disagree with ``GET /orgs/{id}/members``; projects are read
from the authoritative project store by ``org_id``.

``by_role`` is zero-filled over the canonical member-role order for a stable wire
shape across the in-memory and SQLite stores. An unknown organization uses
``AuthRepository.get_organization_or_raise``'s shared 404
``organization_not_found`` envelope; the ``recent_limit`` bound is validated at
the router (shared 422 envelope).

Mirrors ``frontend/src/types/organizationOverview.ts`` contracts.
"""

from __future__ import annotations

from typing import get_args
from uuid import UUID

from ..schemas.auth import MemberRole, Project
from ..schemas.common import utcnow
from ..schemas.organization_overview import OrganizationOverview, OrganizationOverviewCounts
from ..schemas.organization_stats import RoleMemberCount
from ..storage.base import Collections, DocumentStore
from .auth import AuthRepository
from .base import BaseRepository

_ROLES = tuple(get_args(MemberRole))


class OrganizationOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        auth: AuthRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.auth = auth

    def overview(self, org_id: UUID, *, recent_limit: int = 5) -> OrganizationOverview:
        """Build a fresh snapshot for one organization, newest members/projects first."""
        org = self.auth.get_organization_or_raise(org_id)

        # Reuse the authoritative membership projection so the overview agrees with
        # GET /orgs/{id}/members (role/identity data cannot drift).
        members = self.auth.list_members(org_id)
        projects = [
            project
            for project in self._load_all(Collections.PROJECTS, Project)
            if project.org_id == org_id
        ]

        role_counts = {role: 0 for role in _ROLES}
        for member in members:
            role_counts[member.role] = role_counts.get(member.role, 0) + 1
        by_role = [
            RoleMemberCount(role=role, members=role_counts.get(role, 0))
            for role in _ROLES
        ]

        counts = OrganizationOverviewCounts(members=len(members), projects=len(projects))
        recent_members = sorted(
            members, key=lambda member: (member.joined_at, str(member.user_id)), reverse=True
        )[:recent_limit]
        recent_projects = sorted(
            projects, key=lambda project: (project.created_at, str(project.id)), reverse=True
        )[:recent_limit]

        return OrganizationOverview(
            org_id=org.id,
            name=org.name,
            slug=org.slug,
            created_at=org.created_at,
            counts=counts,
            by_role=by_role,
            recent_members=recent_members,
            recent_projects=recent_projects,
            generated_at=self.clock(),
        )


__all__ = ["OrganizationOverviewRepository"]
