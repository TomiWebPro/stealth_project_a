"""Repository composition root."""

from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings
from ..schemas.common import utcnow
from ..storage.base import DocumentStore
from .activity import ActivityRepository
from .assets import AssetRepository
from .asset_stats import AssetStatsRepository
from .audit import AuditRepository
from .auth import AuthRepository
from .conversations import ConversationRepository
from .conversation_stats import ConversationStatsRepository
from .dashboard import DashboardRepository
from .extensions import ExtensionRepository
from .extension_stats import ExtensionStatsRepository
from .impact import ImpactRepository
from .lineage_stats import LineageStatsRepository
from .job_stats import JobStatsRepository
from .jobs import JobRepository
from .operation_stats import OperationStatsRepository
from .pipeline_stats import PipelineStatsRepository
from .organization_stats import OrganizationStatsRepository
from .orchestration import OrchestrationRepository
from .projects import ProjectRepository
from .project_stats import ProjectStatsRepository
from .provider_stats import ProviderStatsRepository
from .providers import ProviderRepository
from .search import SearchRepository
from .tags import TagRepository
from .uploads import UploadRepository


@dataclass(slots=True)
class Repositories:
    activity: ActivityRepository
    projects: ProjectRepository
    project_stats: ProjectStatsRepository
    assets: AssetRepository
    asset_stats: AssetStatsRepository
    conversations: ConversationRepository
    conversation_stats: ConversationStatsRepository
    uploads: UploadRepository
    jobs: JobRepository
    job_stats: JobStatsRepository
    lineage_stats: LineageStatsRepository
    operation_stats: OperationStatsRepository
    pipeline_stats: PipelineStatsRepository
    organization_stats: OrganizationStatsRepository
    providers: ProviderRepository
    provider_stats: ProviderStatsRepository
    orchestration: OrchestrationRepository
    auth: AuthRepository
    extensions: ExtensionRepository
    extension_stats: ExtensionStatsRepository
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
        project_stats = ProjectStatsRepository(store, clock=clock)
        assets = AssetRepository(store, projects, clock=clock)
        asset_stats = AssetStatsRepository(store, projects, clock=clock)
        conversations = ConversationRepository(store, projects, assets, clock=clock)
        conversation_stats = ConversationStatsRepository(store, projects, clock=clock)
        uploads = UploadRepository(
            store, projects, upload_dir=settings.upload_dir, clock=clock
        )
        jobs = JobRepository(store, projects, clock=clock)
        job_stats = JobStatsRepository(store, projects, clock=clock)
        lineage_stats = LineageStatsRepository(store, projects, clock=clock)
        operation_stats = OperationStatsRepository(store, clock=clock)
        pipeline_stats = PipelineStatsRepository(store, projects, clock=clock)
        organization_stats = OrganizationStatsRepository(store, clock=clock)
        providers = ProviderRepository(store, clock=clock)
        provider_stats = ProviderStatsRepository(store, clock=clock)
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
        extension_stats = ExtensionStatsRepository(store, clock=clock)
        audit = AuditRepository(store, projects, assets, jobs, clock=clock)
        search = SearchRepository(store, clock=clock)
        dashboard = DashboardRepository(store, clock=clock)
        activity = ActivityRepository(store, projects, clock=clock)
        tags = TagRepository(store, projects, clock=clock)
        impact = ImpactRepository(store, assets, clock=clock)
        return cls(
            activity=activity,
            projects=projects,
            project_stats=project_stats,
            assets=assets,
            asset_stats=asset_stats,
            conversations=conversations,
            conversation_stats=conversation_stats,
            uploads=uploads,
            jobs=jobs,
            job_stats=job_stats,
            lineage_stats=lineage_stats,
            operation_stats=operation_stats,
            pipeline_stats=pipeline_stats,
            organization_stats=organization_stats,
            providers=providers,
            provider_stats=provider_stats,
            orchestration=orchestration,
            auth=auth,
            extensions=extensions,
            extension_stats=extension_stats,
            audit=audit,
            search=search,
            dashboard=dashboard,
            tags=tags,
            impact=impact,
        )


__all__ = ["Repositories"]
