"""Authoritative project portfolio statistics repository.

Statistics are derived from the authoritative document stores on every call,
like ``DashboardRepository`` and ``AssetStatsRepository``: there is no second
index to drift and removing the router leaves no collection behind.

``by_lifecycle`` is zero-filled over the canonical lifecycle order so the wire
shape is stable across the in-memory and SQLite stores. Soft-deleted assets are
excluded from the asset totals. An optional ``org_id`` narrows projects (and the
domain documents belonging to them) to one organization, matching the
``list_projects?org_id=`` filter.

Mirrors ``frontend/src/types/projectStats.ts`` contracts.
"""

from __future__ import annotations

from typing import get_args
from uuid import UUID

from ..schemas.asset import Asset
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.conversation import Conversation
from ..schemas.operation import Job
from ..schemas.project_stats import (
    ProjectLifecycle,
    ProjectLifecycleCount,
    ProjectStats,
)
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

_LIFECYCLES = tuple(get_args(ProjectLifecycle))


class ProjectStatsRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def stats(self, *, org_id: UUID | None = None) -> ProjectStats:
        """Build fresh project portfolio metrics, optionally scoped to an org."""
        projects = [
            project
            for project in self._load_all(Collections.PROJECTS, Project)
            if org_id is None or project.org_id == org_id
        ]
        project_ids = {project.id for project in projects}
        # When an org scope is supplied, only count domain documents that belong
        # to one of that org's projects (otherwise the averages would mix scopes).
        assets = [
            asset
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.status != "deleted"
            and (org_id is None or asset.project_id in project_ids)
        ]
        conversations = [
            conversation
            for conversation in self._load_all(Collections.CONVERSATIONS, Conversation)
            if org_id is None or conversation.project_id in project_ids
        ]
        jobs = [
            job
            for job in self._load_all(Collections.JOBS, Job)
            if org_id is None or job.project_id in project_ids
        ]

        archived = sum(1 for project in projects if project.archived)
        active = len(projects) - archived
        counts = {"active": active, "archived": archived}
        by_lifecycle = [
            ProjectLifecycleCount(lifecycle=lifecycle, count=counts.get(lifecycle, 0))
            for lifecycle in _LIFECYCLES
        ]

        total = len(projects)
        average_assets = round(len(assets) / total, 3) if total else 0.0
        average_jobs = round(len(jobs) / total, 3) if total else 0.0
        newest = max(
            projects,
            key=lambda project: (project.created_at, str(project.id)),
            default=None,
        )

        return ProjectStats(
            total=total,
            by_lifecycle=by_lifecycle,
            active=active,
            archived=archived,
            total_assets=len(assets),
            total_conversations=len(conversations),
            total_jobs=len(jobs),
            average_assets_per_project=average_assets,
            average_jobs_per_project=average_jobs,
            newest_project_at=newest.created_at if newest else None,
            generated_at=self.clock(),
        )


__all__ = ["ProjectStatsRepository"]
