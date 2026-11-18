"""Repository composition root."""

from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings
from ..schemas.common import utcnow
from ..storage.base import DocumentStore
from .activity import ActivityRepository
from .assets import AssetRepository
from .audit import AuditRepository
from .auth import AuthRepository
from .conversations import ConversationRepository
from .dashboard import DashboardRepository
from .extensions import ExtensionRepository
from .impact import ImpactRepository
from .jobs import JobRepository
from .orchestration import OrchestrationRepository
from .projects import ProjectRepository
from .providers import ProviderRepository
from .search import SearchRepository
from .tags import TagRepository
from .uploads import UploadRepository


@dataclass(slots=True)
class Repositories:
    activity: ActivityRepository
    projects: ProjectRepository
    assets: AssetRepository
    conversations: ConversationRepository
    uploads: UploadRepository
    jobs: JobRepository
    providers: ProviderRepository
    orchestration: OrchestrationRepository
    auth: AuthRepository
    extensions: ExtensionRepository
    audit: AuditRepository
    search: SearchRepository
    dashboard: DashboardRepository
    tags: TagRepository
    impact: ImpactRepository

    @classmethod
    def build(
        cls,
        store: DocumentStore,
        settings: Settings,
        clock=utcnow,
    ) -> "Repositories":
        projects = ProjectRepository(store, clock=clock)
        assets = AssetRepository(store, projects, clock=clock)
        conversations = ConversationRepository(store, projects, assets, clock=clock)
        uploads = UploadRepository(
            store, projects, upload_dir=settings.upload_dir, clock=clock
        )
        jobs = JobRepository(store, projects, clock=clock)
        providers = ProviderRepository(store, clock=clock)
        orchestration = OrchestrationRepository(
            store,
            projects,
            assets,
            storage_quota_bytes=settings.storage_quota_bytes,
            clock=clock,
        )
        auth = AuthRepository(
            store,
            default_user_id=settings.default_user_id,
            default_org_id=settings.default_org_id,
            clock=clock,
        )
        extensions = ExtensionRepository(store, clock=clock)
        audit = AuditRepository(store, projects, assets, jobs, clock=clock)
        search = SearchRepository(store, clock=clock)
        dashboard = DashboardRepository(store, clock=clock)
        activity = ActivityRepository(store, projects, clock=clock)
        tags = TagRepository(store, projects, clock=clock)
        impact = ImpactRepository(store, assets, clock=clock)
        return cls(
            activity=activity,
            projects=projects,
            assets=assets,
            conversations=conversations,
            uploads=uploads,
            jobs=jobs,
            providers=providers,
            orchestration=orchestration,
            auth=auth,
            extensions=extensions,
            audit=audit,
            search=search,
            dashboard=dashboard,
            tags=tags,
            impact=impact,
        )


__all__ = ["Repositories"]
