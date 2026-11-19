"""Repository composition root."""

from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings
from ..schemas.common import utcnow
from ..storage.base import DocumentStore
from .activity import ActivityRepository
from .activity_stats import ActivityStatsRepository
from .assets import AssetRepository
from .asset_stats import AssetStatsRepository
from .audit import AuditRepository
from .auth import AuthRepository
from .conversations import ConversationRepository
from .conversation_stats import ConversationStatsRepository
from .collaboration_stats import CollaborationStatsRepository
from .dashboard import DashboardRepository
from .event_stats import EventStatsRepository
from .extensions import ExtensionRepository
from .extension_stats import ExtensionStatsRepository
from .impact import ImpactRepository
from .lineage_stats import LineageStatsRepository
from .job_stats import JobStatsRepository
from .job_logs import JobLogsRepository
from .job_queue import JobQueueRepository
from .jobs import JobRepository
from .operation_stats import OperationStatsRepository
from .pipeline_stats import PipelineStatsRepository
from .organization_stats import OrganizationStatsRepository
from .orchestration import OrchestrationRepository
from .orchestration_stats import OrchestrationStatsRepository
from .projects import ProjectRepository
from .project_stats import ProjectStatsRepository
from .provider_stats import ProviderStatsRepository
from .providers import ProviderRepository
from .publish_feed import PublishFeedRepository
from .publish_stats import PublishStatsRepository
from .retry_stats import RetryStatsRepository
from .search import SearchRepository
from .search_stats import SearchStatsRepository
from .tags import TagRepository
from .uploads import UploadRepository
from .upload_feed import UploadFeedRepository
from .upload_stats import UploadStatsRepository
from .version_stats import VersionStatsRepository


@dataclass(slots=True)
class Repositories:
    activity: ActivityRepository
    activity_stats: ActivityStatsRepository
    projects: ProjectRepository
    project_stats: ProjectStatsRepository
    assets: AssetRepository
    asset_stats: AssetStatsRepository
    conversations: ConversationRepository
    conversation_stats: ConversationStatsRepository
    collaboration_stats: CollaborationStatsRepository
    uploads: UploadRepository
    upload_feed: UploadFeedRepository
    upload_stats: UploadStatsRepository
    jobs: JobRepository
    job_stats: JobStatsRepository
    job_logs: JobLogsRepository
    job_queue: JobQueueRepository
    lineage_stats: LineageStatsRepository
    operation_stats: OperationStatsRepository
    pipeline_stats: PipelineStatsRepository
    organization_stats: OrganizationStatsRepository
    providers: ProviderRepository
    provider_stats: ProviderStatsRepository
    publish_feed: PublishFeedRepository
    publish_stats: PublishStatsRepository
    retry_stats: RetryStatsRepository
    orchestration: OrchestrationRepository
    orchestration_stats: OrchestrationStatsRepository
    auth: AuthRepository
    event_stats: EventStatsRepository
    extensions: ExtensionRepository
    extension_stats: ExtensionStatsRepository
    audit: AuditRepository
    search: SearchRepository
    search_stats: SearchStatsRepository
    dashboard: DashboardRepository
    tags: TagRepository
    impact: ImpactRepository
    version_stats: VersionStatsRepository

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
        collaboration_stats = CollaborationStatsRepository(store, projects, clock=clock)
        uploads = UploadRepository(
            store, projects, upload_dir=settings.upload_dir, clock=clock
        )
        upload_feed = UploadFeedRepository(store, projects, clock=clock)
        upload_stats = UploadStatsRepository(store, projects, clock=clock)
        jobs = JobRepository(store, projects, clock=clock)
        job_stats = JobStatsRepository(store, projects, clock=clock)
        job_logs = JobLogsRepository(store, jobs, clock=clock)
        job_queue = JobQueueRepository(store, projects, clock=clock)
        lineage_stats = LineageStatsRepository(store, projects, clock=clock)
        operation_stats = OperationStatsRepository(store, clock=clock)
        pipeline_stats = PipelineStatsRepository(store, projects, clock=clock)
        organization_stats = OrganizationStatsRepository(store, clock=clock)
        providers = ProviderRepository(store, clock=clock)
        provider_stats = ProviderStatsRepository(store, clock=clock)
        publish_feed = PublishFeedRepository(store, projects, clock=clock)
        publish_stats = PublishStatsRepository(store, projects, clock=clock)
        retry_stats = RetryStatsRepository(store, projects, clock=clock)
        orchestration = OrchestrationRepository(
            store,
            projects,
            assets,
            storage_quota_bytes=settings.storage_quota_bytes,
            clock=clock,
        )
        orchestration_stats = OrchestrationStatsRepository(store, projects, clock=clock)
        auth = AuthRepository(
            store,
            default_user_id=settings.default_user_id,
            default_org_id=settings.default_org_id,
            clock=clock,
        )
        event_stats = EventStatsRepository(store, projects, clock=clock)
        extensions = ExtensionRepository(store, clock=clock)
        extension_stats = ExtensionStatsRepository(store, clock=clock)
        audit = AuditRepository(store, projects, assets, jobs, clock=clock)
        search = SearchRepository(store, clock=clock)
        search_stats = SearchStatsRepository(store, projects, clock=clock)
        dashboard = DashboardRepository(store, clock=clock)
        activity = ActivityRepository(store, projects, clock=clock)
        activity_stats = ActivityStatsRepository(activity, clock=clock)
        tags = TagRepository(store, projects, clock=clock)
        impact = ImpactRepository(store, assets, clock=clock)
        version_stats = VersionStatsRepository(store, projects, clock=clock)
        return cls(
            activity=activity,
            activity_stats=activity_stats,
            projects=projects,
            project_stats=project_stats,
            assets=assets,
            asset_stats=asset_stats,
            conversations=conversations,
            conversation_stats=conversation_stats,
            collaboration_stats=collaboration_stats,
            uploads=uploads,
            upload_feed=upload_feed,
            upload_stats=upload_stats,
            jobs=jobs,
            job_stats=job_stats,
            job_logs=job_logs,
            job_queue=job_queue,
            lineage_stats=lineage_stats,
            operation_stats=operation_stats,
            pipeline_stats=pipeline_stats,
            organization_stats=organization_stats,
            providers=providers,
            provider_stats=provider_stats,
            publish_feed=publish_feed,
            publish_stats=publish_stats,
            retry_stats=retry_stats,
            orchestration=orchestration,
            orchestration_stats=orchestration_stats,
            auth=auth,
            event_stats=event_stats,
            extensions=extensions,
            extension_stats=extension_stats,
            audit=audit,
            search=search,
            search_stats=search_stats,
            dashboard=dashboard,
            tags=tags,
            impact=impact,
            version_stats=version_stats,
        )


__all__ = ["Repositories"]
