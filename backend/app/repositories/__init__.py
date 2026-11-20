"""Repository composition root."""

from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings
from ..schemas.common import utcnow
from ..storage.base import DocumentStore
from .activity import ActivityRepository
from .activity_stats import ActivityStatsRepository
from .assets import AssetRepository
from .asset_feed import AssetFeedRepository
from .asset_stats import AssetStatsRepository
from .asset_overview import AssetOverviewRepository
from .audit import AuditRepository
from .auth import AuthRepository
from .conversations import ConversationRepository
from .conversation_feed import ConversationFeedRepository
from .conversation_stats import ConversationStatsRepository
from .conversation_overview import ConversationOverviewRepository
from .collaboration_stats import CollaborationStatsRepository
from .collaboration_feed import CollaborationFeedRepository
from .comment_feed import CommentFeedRepository
from .comment_stats import CommentStatsRepository
from .dashboard import DashboardRepository
from .event_feed import EventFeedRepository
from .event_stats import EventStatsRepository
from .extensions import ExtensionRepository
from .extension_feed import ExtensionFeedRepository
from .extension_overview import ExtensionOverviewRepository
from .extension_stats import ExtensionStatsRepository
from .impact import ImpactRepository
from .lineage_feed import LineageFeedRepository
from .lineage_stats import LineageStatsRepository
from .job_stats import JobStatsRepository
from .job_feed import JobFeedRepository
from .job_overview import JobOverviewRepository
from .job_logs import JobLogsRepository
from .job_queue import JobQueueRepository
from .jobs import JobRepository
from .operation_feed import OperationFeedRepository
from .operation_stats import OperationStatsRepository
from .pipeline_stats import PipelineStatsRepository
from .pipeline_feed import PipelineFeedRepository
from .organization_feed import OrganizationFeedRepository
from .organization_stats import OrganizationStatsRepository
from .orchestration import OrchestrationRepository
from .orchestration_feed import OrchestrationFeedRepository
from .orchestration_stats import OrchestrationStatsRepository
from .projects import ProjectRepository
from .project_feed import ProjectFeedRepository
from .project_stats import ProjectStatsRepository
from .project_overview import ProjectOverviewRepository
from .provider_feed import ProviderFeedRepository
from .provider_overview import ProviderOverviewRepository
from .provider_stats import ProviderStatsRepository
from .providers import ProviderRepository
from .publish_feed import PublishFeedRepository
from .publish_stats import PublishStatsRepository
from .retry_feed import RetryFeedRepository
from .retry_stats import RetryStatsRepository
from .search import SearchRepository
from .search_stats import SearchStatsRepository
from .tags import TagRepository
from .uploads import UploadRepository
from .upload_feed import UploadFeedRepository
from .upload_stats import UploadStatsRepository
from .version_feed import VersionFeedRepository
from .version_stats import VersionStatsRepository


@dataclass(slots=True)
class Repositories:
    activity: ActivityRepository
    activity_stats: ActivityStatsRepository
    projects: ProjectRepository
    project_feed: ProjectFeedRepository
    project_stats: ProjectStatsRepository
    project_overview: ProjectOverviewRepository
    assets: AssetRepository
    asset_feed: AssetFeedRepository
    asset_stats: AssetStatsRepository
    asset_overview: AssetOverviewRepository
    conversations: ConversationRepository
    conversation_feed: ConversationFeedRepository
    conversation_stats: ConversationStatsRepository
    conversation_overview: ConversationOverviewRepository
    collaboration_stats: CollaborationStatsRepository
    collaboration_feed: CollaborationFeedRepository
    comment_feed: CommentFeedRepository
    comment_stats: CommentStatsRepository
    uploads: UploadRepository
    upload_feed: UploadFeedRepository
    upload_stats: UploadStatsRepository
    jobs: JobRepository
    job_stats: JobStatsRepository
    job_feed: JobFeedRepository
    job_overview: JobOverviewRepository
    job_logs: JobLogsRepository
    job_queue: JobQueueRepository
    lineage_feed: LineageFeedRepository
    lineage_stats: LineageStatsRepository
    operation_feed: OperationFeedRepository
    operation_stats: OperationStatsRepository
    pipeline_stats: PipelineStatsRepository
    pipeline_feed: PipelineFeedRepository
    organization_feed: OrganizationFeedRepository
    organization_stats: OrganizationStatsRepository
    providers: ProviderRepository
    provider_feed: ProviderFeedRepository
    provider_stats: ProviderStatsRepository
    provider_overview: ProviderOverviewRepository
    publish_feed: PublishFeedRepository
    publish_stats: PublishStatsRepository
    retry_feed: RetryFeedRepository
    retry_stats: RetryStatsRepository
    orchestration: OrchestrationRepository
    orchestration_feed: OrchestrationFeedRepository
    orchestration_stats: OrchestrationStatsRepository
    auth: AuthRepository
    event_feed: EventFeedRepository
    event_stats: EventStatsRepository
    extensions: ExtensionRepository
    extension_feed: ExtensionFeedRepository
    extension_overview: ExtensionOverviewRepository
    extension_stats: ExtensionStatsRepository
    audit: AuditRepository
    search: SearchRepository
    search_stats: SearchStatsRepository
    dashboard: DashboardRepository
    tags: TagRepository
    impact: ImpactRepository
    version_feed: VersionFeedRepository
    version_stats: VersionStatsRepository

    @classmethod
    def build(
        cls,
        store: DocumentStore,
        settings: Settings,
        clock=utcnow,
    ) -> "Repositories":
        projects = ProjectRepository(store, clock=clock)
        project_feed = ProjectFeedRepository(store, clock=clock)
        project_stats = ProjectStatsRepository(store, clock=clock)
        project_overview = ProjectOverviewRepository(store, projects, clock=clock)
        assets = AssetRepository(store, projects, clock=clock)
        asset_feed = AssetFeedRepository(store, projects, clock=clock)
        asset_stats = AssetStatsRepository(store, projects, clock=clock)
        asset_overview = AssetOverviewRepository(store, assets, projects, clock=clock)
        conversations = ConversationRepository(store, projects, assets, clock=clock)
        conversation_feed = ConversationFeedRepository(store, projects, clock=clock)
        conversation_stats = ConversationStatsRepository(store, projects, clock=clock)
        conversation_overview = ConversationOverviewRepository(store, conversations, clock=clock)
        collaboration_stats = CollaborationStatsRepository(store, projects, clock=clock)
        collaboration_feed = CollaborationFeedRepository(store, projects, clock=clock)
        comment_feed = CommentFeedRepository(store, projects, clock=clock)
        comment_stats = CommentStatsRepository(store, projects, clock=clock)
        uploads = UploadRepository(
            store, projects, upload_dir=settings.upload_dir, clock=clock
        )
        upload_feed = UploadFeedRepository(store, projects, clock=clock)
        upload_stats = UploadStatsRepository(store, projects, clock=clock)
        jobs = JobRepository(store, projects, clock=clock)
        job_stats = JobStatsRepository(store, projects, clock=clock)
        job_feed = JobFeedRepository(store, projects, clock=clock)
        job_overview = JobOverviewRepository(store, jobs, clock=clock)
        job_logs = JobLogsRepository(store, jobs, clock=clock)
        job_queue = JobQueueRepository(store, projects, clock=clock)
        lineage_feed = LineageFeedRepository(store, projects, clock=clock)
        lineage_stats = LineageStatsRepository(store, projects, clock=clock)
        operation_feed = OperationFeedRepository(store, clock=clock)
        operation_stats = OperationStatsRepository(store, clock=clock)
        pipeline_stats = PipelineStatsRepository(store, projects, clock=clock)
        pipeline_feed = PipelineFeedRepository(store, projects, clock=clock)
        organization_feed = OrganizationFeedRepository(store, clock=clock)
        organization_stats = OrganizationStatsRepository(store, clock=clock)
        providers = ProviderRepository(store, clock=clock)
        provider_feed = ProviderFeedRepository(store, clock=clock)
        provider_stats = ProviderStatsRepository(store, clock=clock)
        provider_overview = ProviderOverviewRepository(store, providers, clock=clock)
        publish_feed = PublishFeedRepository(store, projects, clock=clock)
        publish_stats = PublishStatsRepository(store, projects, clock=clock)
        retry_feed = RetryFeedRepository(store, projects, clock=clock)
        retry_stats = RetryStatsRepository(store, projects, clock=clock)
        orchestration = OrchestrationRepository(
            store,
            projects,
            assets,
            storage_quota_bytes=settings.storage_quota_bytes,
            clock=clock,
        )
        orchestration_feed = OrchestrationFeedRepository(store, projects, clock=clock)
        orchestration_stats = OrchestrationStatsRepository(store, projects, clock=clock)
        auth = AuthRepository(
            store,
            default_user_id=settings.default_user_id,
            default_org_id=settings.default_org_id,
            clock=clock,
        )
        event_feed = EventFeedRepository(store, projects, clock=clock)
        event_stats = EventStatsRepository(store, projects, clock=clock)
        extensions = ExtensionRepository(store, clock=clock)
        extension_feed = ExtensionFeedRepository(store, clock=clock)
        extension_overview = ExtensionOverviewRepository(store, extensions, clock=clock)
        extension_stats = ExtensionStatsRepository(store, clock=clock)
        audit = AuditRepository(store, projects, assets, jobs, clock=clock)
        search = SearchRepository(store, clock=clock)
        search_stats = SearchStatsRepository(store, projects, clock=clock)
        dashboard = DashboardRepository(store, clock=clock)
        activity = ActivityRepository(store, projects, clock=clock)
        activity_stats = ActivityStatsRepository(activity, clock=clock)
        tags = TagRepository(store, projects, clock=clock)
        impact = ImpactRepository(store, assets, clock=clock)
        version_feed = VersionFeedRepository(store, projects, clock=clock)
        version_stats = VersionStatsRepository(store, projects, clock=clock)
        return cls(
            activity=activity,
            activity_stats=activity_stats,
            projects=projects,
            project_feed=project_feed,
            project_stats=project_stats,
            project_overview=project_overview,
            assets=assets,
            asset_feed=asset_feed,
            asset_stats=asset_stats,
            asset_overview=asset_overview,
            conversations=conversations,
            conversation_feed=conversation_feed,
            conversation_stats=conversation_stats,
            conversation_overview=conversation_overview,
            collaboration_stats=collaboration_stats,
            collaboration_feed=collaboration_feed,
            comment_feed=comment_feed,
            comment_stats=comment_stats,
            uploads=uploads,
            upload_feed=upload_feed,
            upload_stats=upload_stats,
            jobs=jobs,
            job_stats=job_stats,
            job_feed=job_feed,
            job_overview=job_overview,
            job_logs=job_logs,
            job_queue=job_queue,
            lineage_feed=lineage_feed,
            lineage_stats=lineage_stats,
            operation_feed=operation_feed,
            operation_stats=operation_stats,
            pipeline_stats=pipeline_stats,
            pipeline_feed=pipeline_feed,
            organization_feed=organization_feed,
            organization_stats=organization_stats,
            providers=providers,
            provider_feed=provider_feed,
            provider_stats=provider_stats,
            provider_overview=provider_overview,
            publish_feed=publish_feed,
            publish_stats=publish_stats,
            retry_feed=retry_feed,
            retry_stats=retry_stats,
            orchestration=orchestration,
            orchestration_feed=orchestration_feed,
            orchestration_stats=orchestration_stats,
            auth=auth,
            event_feed=event_feed,
            event_stats=event_stats,
            extensions=extensions,
            extension_feed=extension_feed,
            extension_overview=extension_overview,
            extension_stats=extension_stats,
            audit=audit,
            search=search,
            search_stats=search_stats,
            dashboard=dashboard,
            tags=tags,
            impact=impact,
            version_feed=version_feed,
            version_stats=version_stats,
        )


__all__ = ["Repositories"]
