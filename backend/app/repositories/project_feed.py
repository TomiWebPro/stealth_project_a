"""Authoritative project feed repository.

The feed is derived fresh from the ``PROJECTS`` collection — the same store
``ProjectRepository`` writes and ``ProjectStatsRepository`` aggregates — so it
can never drift from ``GET /projects`` or ``GET /projects/stats``. There is no
persisted feed or second index — removing this router leaves no collection
behind.

Organization display names are joined from the authoritative ``ORGANIZATIONS``
store; a project whose organization is missing falls back to a stable display
name rather than being dropped. Ordering is by descending
``(created_at, project_id)`` so the newest project comes first and ties are
broken deterministically across the in-memory and SQLite adapters. ``total``
counts the whole filtered feed before the ``limit`` page is applied. The
``lifecycle`` label is derived from the project's ``archived`` flag.

Unlike resource feeds scoped by resource id, an unknown-but-well-formed
``org_id`` yields a zero-filled feed (matching ``GET /projects?org_id=`` and
``/projects/stats?org_id=``); a malformed id uses the shared 422 envelope at the
router. Bounds are validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/projectFeed.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.auth import Organization, Project
from ..schemas.common import utcnow
from ..schemas.project_feed import ProjectFeed, ProjectFeedItem
from ..schemas.project_stats import ProjectLifecycle
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

_UNKNOWN_ORG_NAME = "Unknown organization"


def _lifecycle(project: Project) -> ProjectLifecycle:
    return "archived" if project.archived else "active"


class ProjectFeedRepository(BaseRepository):
    def feed(
        self,
        *,
        org_id: UUID | None = None,
        lifecycle: ProjectLifecycle | None = None,
        limit: int = 50,
    ) -> ProjectFeed:
        """Build the newest-first project feed, optionally scoped to an org/lifecycle.

        ``total`` counts every project in scope before the ``limit`` page is
        applied. ``items`` holds at most ``limit`` entries in descending
        ``(created_at, project_id)`` order with a stable id tie-break.
        """
        org_names = {
            org.id: org.name
            for org in self._load_all(Collections.ORGANIZATIONS, Organization)
        }

        projects = [
            project
            for project in self._load_all(Collections.PROJECTS, Project)
            if (org_id is None or project.org_id == org_id)
            and (lifecycle is None or _lifecycle(project) == lifecycle)
        ]
        projects.sort(key=lambda project: (project.created_at, str(project.id)), reverse=True)

        items = [
            ProjectFeedItem(
                project_id=project.id,
                org_id=project.org_id,
                org_name=org_names.get(project.org_id, _UNKNOWN_ORG_NAME),
                name=project.name,
                description=project.description,
                lifecycle=_lifecycle(project),
                created_by=project.created_by,
                created_at=project.created_at,
                updated_at=project.updated_at,
            )
            for project in projects
        ]

        return ProjectFeed(
            items=items[:limit],
            total=len(items),
            generated_at=self.clock(),
        )


__all__ = ["ProjectFeedRepository", "_UNKNOWN_ORG_NAME"]
