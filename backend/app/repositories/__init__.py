"""Repository composition root."""

from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings
from ..schemas.common import utcnow
from ..storage.base import DocumentStore
from .activity import ActivityRepository
from .activity_stats import ActivityStatsRepository
from .activity_overview import ActivityOverviewRepository
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
from .message_overview import MessageOverviewRepository
from .collaboration_stats import CollaborationStatsRepository
from .collaboration_feed import CollaborationFeedRepository
from .collaboration_overview import CollaborationOverviewRepository
from .comment_feed import CommentFeedRepository
from .comment_stats import CommentStatsRepository
from .comment_overview import CommentOverviewRepository
from .dashboard import DashboardRepository
from .event_feed import EventFeedRepository
from .event_stats import EventStatsRepository
from .event_overview import EventOverviewRepository
from .extensions import ExtensionRepository
from .extension_feed import ExtensionFeedRepository
from .extension_overview import ExtensionOverviewRepository
from .extension_stats import ExtensionStatsRepository
from .impact import ImpactRepository
from .lineage_feed import LineageFeedRepository
from .lineage_stats import LineageStatsRepository
from .lineage_overview import LineageOverviewRepository
from .job_stats import JobStatsRepository
from .job_feed import JobFeedRepository
from .job_overview import JobOverviewRepository
from .job_logs import JobLogsRepository
from .job_queue import JobQueueRepository
from .jobs import JobRepository
from .capability_overview import CapabilityOverviewRepository
from .operation_feed import OperationFeedRepository
from .operation_overview import OperationOverviewRepository
from .operation_stats import OperationStatsRepository
from .pipeline_stats import PipelineStatsRepository
from .pipeline_feed import PipelineFeedRepository
from .chain_overview import ChainOverviewRepository
from .organization_feed import OrganizationFeedRepository
from .organization_stats import OrganizationStatsRepository
from .organization_overview import OrganizationOverviewRepository
from .orchestration import OrchestrationRepository
from .orchestration_feed import OrchestrationFeedRepository
from .orchestration_stats import OrchestrationStatsRepository
from .plan_overview import PlanOverviewRepository
from .run_overview import RunOverviewRepository
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
from .publish_overview import PublishOverviewRepository
from .retry_feed import RetryFeedRepository
from .retry_stats import RetryStatsRepository
from .retry_overview import RetryOverviewRepository
from .search import SearchRepository
from .search_stats import SearchStatsRepository
from .tags import TagRepository
from .tag_overview import TagOverviewRepository
from .uploads import UploadRepository
from .upload_feed import UploadFeedRepository
from .upload_overview import UploadOverviewRepository
from .upload_stats import UploadStatsRepository
from .user_overview import UserOverviewRepository
from .membership_overview import MembershipOverviewRepository
from .version_feed import VersionFeedRepository
from .version_stats import VersionStatsRepository
from .version_overview import VersionOverviewRepository


@dataclass(slots=True)
class Repositories:
    activity: ActivityRepository
    activity_stats: ActivityStatsRepository
    activity_overview: ActivityOverviewRepository
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
    message_overview: MessageOverviewRepository
    collaboration_stats: CollaborationStatsRepository
    collaboration_feed: CollaborationFeedRepository
    collaboration_overview: CollaborationOverviewRepository
    comment_feed: CommentFeedRepository
    comment_stats: CommentStatsRepository
    comment_overview: CommentOverviewRepository
    uploads: UploadRepository
    upload_feed: UploadFeedRepository
    upload_overview: UploadOverviewRepository
    upload_stats: UploadStatsRepository
    user_overview: UserOverviewRepository
    membership_overview: MembershipOverviewRepository
    jobs: JobRepository
    job_stats: JobStatsRepository
    job_feed: JobFeedRepository
    job_overview: JobOverviewRepository
    job_logs: JobLogsRepository
    job_queue: JobQueueRepository
    lineage_feed: LineageFeedRepository
    lineage_stats: LineageStatsRepository
    lineage_overview: LineageOverviewRepository
    operation_feed: OperationFeedRepository
    operation_overview: OperationOverviewRepository
    operation_stats: OperationStatsRepository
    pipeline_stats: PipelineStatsRepository
    pipeline_feed: PipelineFeedRepository
    chain_overview: ChainOverviewRepository
    organization_feed: OrganizationFeedRepository
    organization_stats: OrganizationStatsRepository
    organization_overview: OrganizationOverviewRepository
    providers: ProviderRepository
    capability_overview: CapabilityOverviewRepository
    provider_feed: ProviderFeedRepository
    provider_stats: ProviderStatsRepository
    provider_overview: ProviderOverviewRepository
    publish_feed: PublishFeedRepository
    publish_stats: PublishStatsRepository
    publish_overview: PublishOverviewRepository
    retry_feed: RetryFeedRepository
    retry_stats: RetryStatsRepository
    retry_overview: RetryOverviewRepository
    orchestration: OrchestrationRepository
    orchestration_feed: OrchestrationFeedRepository
    orchestration_stats: OrchestrationStatsRepository
    plan_overview: PlanOverviewRepository
    run_overview: RunOverviewRepository
    auth: AuthRepository
    event_feed: EventFeedRepository
    event_stats: EventStatsRepository
    event_overview: EventOverviewRepository
    extensions: ExtensionRepository
    extension_feed: ExtensionFeedRepository
    extension_overview: ExtensionOverviewRepository
    extension_stats: ExtensionStatsRepository
    audit: AuditRepository
    search: SearchRepository
    search_stats: SearchStatsRepository
    dashboard: DashboardRepository
    tags: TagRepository
    tag_overview: TagOverviewRepository
    impact: ImpactRepository
    version_feed: VersionFeedRepository
    version_stats: VersionStatsRepository
    version_overview: VersionOverviewRepository

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
        message_overview = MessageOverviewRepository(store, conversations, clock=clock)
        collaboration_stats = CollaborationStatsRepository(store, projects, clock=clock)
        collaboration_feed = CollaborationFeedRepository(store, projects, clock=clock)
        collaboration_overview = CollaborationOverviewRepository(
            store, collaboration_feed, clock=clock
        )
        comment_feed = CommentFeedRepository(store, projects, clock=clock)
        comment_stats = CommentStatsRepository(store, projects, clock=clock)
        comment_overview = CommentOverviewRepository(store, projects, clock=clock)
        uploads = UploadRepository(
            store, projects, upload_dir=settings.upload_dir, clock=clock
        )
        upload_feed = UploadFeedRepository(store, projects, clock=clock)
        upload_overview = UploadOverviewRepository(store, projects, clock=clock)
        upload_stats = UploadStatsRepository(store, projects, clock=clock)
        user_overview = UserOverviewRepository(store, clock=clock)
        membership_overview = MembershipOverviewRepository(store, clock=clock)
        jobs = JobRepository(store, projects, clock=clock)
        job_stats = JobStatsRepository(store, projects, clock=clock)
        job_feed = JobFeedRepository(store, projects, clock=clock)
        job_overview = JobOverviewRepository(store, jobs, clock=clock)
        job_logs = JobLogsRepository(store, jobs, clock=clock)
        job_queue = JobQueueRepository(store, projects, clock=clock)
        lineage_feed = LineageFeedRepository(store, projects, clock=clock)
        lineage_stats = LineageStatsRepository(store, projects, clock=clock)
        lineage_overview = LineageOverviewRepository(store, projects, clock=clock)
        operation_feed = OperationFeedRepository(store, clock=clock)
        operation_stats = OperationStatsRepository(store, clock=clock)
        pipeline_stats = PipelineStatsRepository(store, projects, clock=clock)
        pipeline_feed = PipelineFeedRepository(store, projects, clock=clock)
        chain_overview = ChainOverviewRepository(store, projects, clock=clock)
        organization_feed = OrganizationFeedRepository(store, clock=clock)
        organization_stats = OrganizationStatsRepository(store, clock=clock)
        providers = ProviderRepository(store, clock=clock)
        capability_overview = CapabilityOverviewRepository(store, providers, clock=clock)
        operation_overview = OperationOverviewRepository(store, providers, clock=clock)
        provider_feed = ProviderFeedRepository(store, clock=clock)
        provider_stats = ProviderStatsRepository(store, clock=clock)
        provider_overview = ProviderOverviewRepository(store, providers, clock=clock)
        publish_feed = PublishFeedRepository(store, projects, clock=clock)
        publish_stats = PublishStatsRepository(store, projects, clock=clock)
        publish_overview = PublishOverviewRepository(store, assets, projects, clock=clock)
        retry_feed = RetryFeedRepository(store, projects, clock=clock)
        retry_stats = RetryStatsRepository(store, projects, clock=clock)
        retry_overview = RetryOverviewRepository(store, jobs, clock=clock)
        orchestration = OrchestrationRepository(
            store,
            projects,
            assets,
            storage_quota_bytes=settings.storage_quota_bytes,
            clock=clock,
        )
        orchestration_feed = OrchestrationFeedRepository(store, projects, clock=clock)
        orchestration_stats = OrchestrationStatsRepository(store, projects, clock=clock)
        plan_overview = PlanOverviewRepository(store, projects, clock=clock)
        run_overview = RunOverviewRepository(store, projects, clock=clock)
        auth = AuthRepository(
            store,
            default_user_id=settings.default_user_id,
            default_org_id=settings.default_org_id,
            clock=clock,
        )
        organization_overview = OrganizationOverviewRepository(store, auth, clock=clock)
        event_feed = EventFeedRepository(store, projects, clock=clock)
        event_stats = EventStatsRepository(store, projects, clock=clock)
        event_overview = EventOverviewRepository(store, jobs, clock=clock)
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
        activity_overview = ActivityOverviewRepository(
            store, activity, projects, clock=clock
        )
        tags = TagRepository(store, projects, clock=clock)
        tag_overview = TagOverviewRepository(store, projects, clock=clock)
        impact = ImpactRepository(store, assets, clock=clock)
        version_feed = VersionFeedRepository(store, projects, clock=clock)
        version_stats = VersionStatsRepository(store, projects, clock=clock)
        version_overview = VersionOverviewRepository(store, assets, projects, clock=clock)
        return cls(
            activity=activity,
            activity_stats=activity_stats,
            activity_overview=activity_overview,
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
            message_overview=message_overview,
            collaboration_stats=collaboration_stats,
            collaboration_feed=collaboration_feed,
            collaboration_overview=collaboration_overview,
            comment_feed=comment_feed,
            comment_stats=comment_stats,
            comment_overview=comment_overview,
            uploads=uploads,
            upload_feed=upload_feed,
            upload_overview=upload_overview,
            upload_stats=upload_stats,
            user_overview=user_overview,
            membership_overview=membership_overview,
            jobs=jobs,
            job_stats=job_stats,
            job_feed=job_feed,
            job_overview=job_overview,
            job_logs=job_logs,
            job_queue=job_queue,
            lineage_feed=lineage_feed,
            lineage_stats=lineage_stats,
            lineage_overview=lineage_overview,
            operation_feed=operation_feed,
            operation_overview=operation_overview,
            operation_stats=operation_stats,
            pipeline_stats=pipeline_stats,
            pipeline_feed=pipeline_feed,
            chain_overview=chain_overview,
            organization_feed=organization_feed,
            organization_stats=organization_stats,
            organization_overview=organization_overview,
            providers=providers,
            capability_overview=capability_overview,
            provider_feed=provider_feed,
            provider_stats=provider_stats,
            provider_overview=provider_overview,
            publish_feed=publish_feed,
            publish_stats=publish_stats,
            publish_overview=publish_overview,
            retry_feed=retry_feed,
            retry_stats=retry_stats,
            retry_overview=retry_overview,
            orchestration=orchestration,
            orchestration_feed=orchestration_feed,
            orchestration_stats=orchestration_stats,
            plan_overview=plan_overview,
            run_overview=run_overview,
            auth=auth,
            event_feed=event_feed,
            event_stats=event_stats,
            event_overview=event_overview,
            extensions=extensions,
            extension_feed=extension_feed,
            extension_overview=extension_overview,
            extension_stats=extension_stats,
            audit=audit,
            search=search,
            search_stats=search_stats,
            dashboard=dashboard,
            tags=tags,
            tag_overview=tag_overview,
            impact=impact,
            version_feed=version_feed,
            version_stats=version_stats,
            version_overview=version_overview,
        )


__all__ = ["Repositories"]
