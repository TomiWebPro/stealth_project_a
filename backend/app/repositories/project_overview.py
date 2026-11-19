"""Authoritative single-project overview repository.

The snapshot is derived fresh from the authoritative stores on every call, like
``DashboardRepository`` and ``ProjectStatsRepository``: there is no second index
to drift and removing the router leaves no collection behind. Every document is
attributed to one project via its ``project_id`` (asset versions and publishes
via their parent live asset), so the overview agrees with the resource routers
and with the workspace ``/dashboard``.

An unknown project raises ``NotFoundError`` for the shared 404 envelope; the
``recent_limit`` bound is validated at the router (shared 422 envelope).

Mirrors ``frontend/src/types/projectOverview.ts`` contracts.
"""

from __future__ import annotations

from uuid import UUID

from ..schemas.asset import Asset, AssetVersion
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.conversation import Conversation
from ..schemas.operation import Job
from ..schemas.orchestration import Comment, Presence
from ..schemas.project_overview import ProjectOverview, ProjectOverviewCounts
from ..schemas.project_stats import ProjectLifecycle
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository
from .projects import ProjectRepository
from .publish_stats import _parse_receipt


class ProjectOverviewRepository(BaseRepository):
    def __init__(
        self,
        store: DocumentStore,
        projects: ProjectRepository,
        clock=utcnow,
    ) -> None:
        super().__init__(store, clock)
        self.projects = projects

    def overview(self, project_id: UUID, *, recent_limit: int = 5) -> ProjectOverview:
        """Build a fresh snapshot for one project, newest jobs/assets first."""
        project = self.projects.get_or_raise(project_id)

        assets = [
            asset
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.project_id == project_id and asset.status != "deleted"
        ]
        live_asset_ids = {asset.id for asset in assets}

        conversations = [
            conversation
            for conversation in self._load_all(Collections.CONVERSATIONS, Conversation)
            if conversation.project_id == project_id
        ]
        jobs = [
            job for job in self._load_all(Collections.JOBS, Job) if job.project_id == project_id
        ]
        comments = [
            comment
            for comment in self._load_all(Collections.COMMENTS, Comment)
            if comment.project_id == project_id
        ]
        presence = [
            signal
            for signal in self._load_all(Collections.PRESENCE, Presence)
            if signal.project_id == project_id
        ]
        # Versions of soft-deleted/unknown assets are excluded (matching
        # /versions/stats), keeping the total consistent with the live asset set.
        versions = [
            version
            for version in self._load_all(Collections.ASSET_VERSIONS, AssetVersion)
            if version.asset_id in live_asset_ids
        ]
        # Reuse the publish-stats receipt parser so the publish count can never
        # drift from GET /publishes/stats for this project.
        publishes = sum(
            1
            for asset in assets
            if _parse_receipt(asset.metadata.get("publish_receipt")) is not None
        )

        counts = ProjectOverviewCounts(
            assets=len(assets),
            conversations=len(conversations),
            jobs=len(jobs),
            comments=len(comments),
            publishes=publishes,
            versions=len(versions),
            collaborators=len({signal.user_id for signal in presence}),
        )

        recent_jobs = sorted(
            jobs, key=lambda job: (job.created_at, str(job.id)), reverse=True
        )[:recent_limit]
        recent_assets = sorted(
            assets, key=lambda asset: (asset.created_at, str(asset.id)), reverse=True
        )[:recent_limit]

        lifecycle: ProjectLifecycle = "archived" if project.archived else "active"
        return ProjectOverview(
            project_id=project.id,
            project_name=project.name,
            lifecycle=lifecycle,
            created_at=project.created_at,
            counts=counts,
            recent_jobs=recent_jobs,
            recent_assets=recent_assets,
            generated_at=self.clock(),
        )


__all__ = ["ProjectOverviewRepository"]
