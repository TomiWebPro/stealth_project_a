"""Authoritative organization-feed repository.

The feed is derived fresh from the authoritative ``ORGANIZATIONS`` collection —
the same store ``AuthRepository`` writes and ``OrganizationStatsRepository``
aggregates — so it can never drift from ``GET /orgs`` or ``GET /orgs/stats``. There
is no persisted feed or second index; removing this router leaves no collection
behind.

Member counts and project counts are joined from the authoritative ``MEMBERS`` and
``PROJECTS`` stores. Membership documents carry an extra ``_org_id`` discriminator
(the same shape ``AuthRepository.list_members`` and ``OrganizationStatsRepository``
rebuild into ``Member`` models), so malformed or orphan records are skipped.
Ordering is by descending ``(created_at, org_id)`` so the newest organization comes
first and ties are broken deterministically across the in-memory and SQLite
adapters. ``total`` counts the whole feed before the ``limit`` page is applied.
Bounds are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/organizationFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Organization, Project
from ..schemas.common import utcnow
from ..schemas.organization_feed import OrganizationFeed, OrganizationFeedItem
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository


class OrganizationFeedRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def feed(self, *, limit: int = 50) -> OrganizationFeed:
        """Build the newest-first organization feed with authoritative joins.

        ``total`` counts every organization before the ``limit`` page is applied.
        ``items`` holds at most ``limit`` entries in descending
        ``(created_at, org_id)`` order with a stable id tie-break.
        """
        organizations = self._load_all(Collections.ORGANIZATIONS, Organization)
        org_ids = {org.id for org in organizations}

        # Membership documents carry an extra `_org_id` discriminator; count only
        # members that resolve to an organization in scope, as the stats snapshot
        # does. Malformed discriminators are skipped.
        member_counts: dict[UUID, int] = {org_id: 0 for org_id in org_ids}
        for document in self.store.all(Collections.MEMBERS):
            raw_org_id = document.get("_org_id")
            if raw_org_id is None:
                continue
            try:
                member_org_id = UUID(str(raw_org_id))
            except ValueError:
                continue
            if member_org_id in member_counts:
                member_counts[member_org_id] += 1

        project_counts: dict[UUID, int] = {org_id: 0 for org_id in org_ids}
        for project in self._load_all(Collections.PROJECTS, Project):
            if project.org_id in project_counts:
                project_counts[project.org_id] += 1

        organizations.sort(key=lambda org: (org.created_at, str(org.id)), reverse=True)

        items = [
            OrganizationFeedItem(
                org_id=org.id,
                name=org.name,
                slug=org.slug,
                member_count=member_counts[org.id],
                project_count=project_counts[org.id],
                created_at=org.created_at,
            )
            for org in organizations
        ]

        return OrganizationFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["OrganizationFeedRepository"]
