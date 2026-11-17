"""Dashboard summary repository.

Everything is derived from the authoritative stores on every call, like
``AuditRepository`` and ``SearchRepository``: there is no second index to drift
and the feature is fully reversible (removing the router leaves no collection
behind). Deleted assets are excluded from counts, breakdowns and recency so the
snapshot agrees with ``GET /assets``.
"""

from __future__ import annotations

from typing import get_args

from ..schemas.asset import Asset, AssetType
from ..schemas.auth import Project
from ..schemas.common import utcnow
from ..schemas.conversation import Conversation
from ..schemas.dashboard import DashboardCounts, DashboardSummary
from ..schemas.operation import Job, JobStatus
from ..schemas.provider import Extension, Provider
from ..storage.base import Collections, DocumentStore
from .base import BaseRepository

# Zero-filled so UI badges can read `jobs_by_status["running"]` directly.
_STATUSES = tuple(get_args(JobStatus))
_ASSET_TYPES = tuple(get_args(AssetType))


class DashboardRepository(BaseRepository):
    def __init__(self, store: DocumentStore, clock=utcnow) -> None:
        super().__init__(store, clock)

    def summary(self, *, recent_limit: int = 5) -> DashboardSummary:
        """Build a fresh workspace snapshot, newest jobs/assets first."""
        projects = self._load_all(Collections.PROJECTS, Project)
        assets = [
            asset
            for asset in self._load_all(Collections.ASSETS, Asset)
            if asset.status != "deleted"
        ]
        conversations = self._load_all(Collections.CONVERSATIONS, Conversation)
        jobs = self._load_all(Collections.JOBS, Job)
        providers = self._load_all(Collections.PROVIDERS, Provider)
        extensions = self._load_all(Collections.EXTENSIONS, Extension)

        counts = DashboardCounts(
            projects=len(projects),
            assets=len(assets),
            conversations=len(conversations),
            jobs=len(jobs),
            providers=len(providers),
            enabled_extensions=sum(1 for ext in extensions if ext.status == "enabled"),
        )

        jobs_by_status = {status: 0 for status in _STATUSES}
        for job in jobs:
            jobs_by_status[job.status] = jobs_by_status.get(job.status, 0) + 1

        assets_by_type = {asset_type: 0 for asset_type in _ASSET_TYPES}
        for asset in assets:
            assets_by_type[asset.type] = assets_by_type.get(asset.type, 0) + 1

        recent_jobs = sorted(
            jobs, key=lambda job: (job.created_at, str(job.id)), reverse=True
        )[:recent_limit]
        recent_assets = sorted(
            assets, key=lambda asset: (asset.created_at, str(asset.id)), reverse=True
        )[:recent_limit]

        return DashboardSummary(
            counts=counts,
            generated_at=self.clock(),
            jobs_by_status=jobs_by_status,
            assets_by_type=assets_by_type,
            recent_jobs=recent_jobs,
            recent_assets=recent_assets,
        )


__all__ = ["DashboardRepository"]
