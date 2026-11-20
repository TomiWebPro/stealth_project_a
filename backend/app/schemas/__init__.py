"""Public schema surface for the Studio Platform API.

Every module here mirrors a file in frontend/src/types. Parity is verified by
tests/test_contract_parity.py — do not change one side without the other.
"""

from .activity import (
    ActivityEvent,
    ActivityFeed,
    ActivityKind,
    ActivityTone,
)
from .activity_stats import (
    ActivityKindCount,
    ActivityProjectCount,
    ActivityStats,
)
from .audit import (
    AuditEvent,
    AuditEventKind,
    AuditTone,
    AuditTrail,
)
from .asset_feed import (
    AssetFeed,
    AssetFeedItem,
)
from .asset_stats import (
    AssetStats,
    AssetStatusCount,
    AssetTypeCount,
)
from .asset import (
    Asset,
    AssetLineage,
    AssetLineageNode,
    AssetProps,
    AssetRegisterRequest,
    AssetRelationship,
    AssetStatus,
    AssetType,
    AssetUpdate,
    AssetVersion,
    AssetVersionCreate,
    AssetVersionCreateRequest,
    AssetVersionRegisterRequest,
    AssetVersionRequest,
    CreateAssetVersionRequest,
    DownloadTicket,
    Provenance,
    RelationshipType,
    StorageRef,
    UploadRequest,
    UploadTicket,
)
from .asset_overview import (
    AssetOverview,
    AssetOverviewCounts,
)
from .auth import (
    LoginRequest,
    Member,
    MemberInvite,
    MemberRole,
    Organization,
    OrganizationCreate,
    Project,
    ProjectCreate,
    ProjectUpdate,
    RefreshRequest,
    SessionResponse,
    TokenPair,
    User,
)
from .dashboard import (
    DashboardCounts,
    DashboardSummary,
)
from .event_feed import (
    EventFeed,
    EventFeedItem,
)
from .event_stats import (
    EventJobCount,
    EventStats,
    EventTypeCount,
)
from .extension_feed import (
    ExtensionFeed,
    ExtensionFeedItem,
)
from .extension_overview import (
    ExtensionOverview,
    ExtensionOverviewCounts,
)
from .extension_stats import (
    ExtensionPermissionStat,
    ExtensionStats,
    ExtensionStatusCount,
    ExtensionTypeCount,
)
from .impact import (
    AssetImpact,
    ImpactNode,
)
from .lineage_feed import (
    LineageFeed,
    LineageFeedItem,
)
from .lineage_stats import (
    LineageProjectCount,
    LineageStats,
    LineageTypeCount,
)
from .job_stats import (
    JobStats,
    JobStatusCount,
    OperationJobStat,
)
from .job_feed import (
    JobFeed,
    JobFeedItem,
)
from .job_overview import (
    JobOverview,
    JobOverviewCounts,
)
from .job_logs import (
    JobLogEntry,
    JobLogFrame,
    LogLevel,
)
from .job_queue import (
    JobQueueEntry,
    JobQueueView,
)
from .common import (
    API_PREFIX,
    API_VERSION,
    ContractModel,
    Email,
    Empty,
    ErrorBody,
    ErrorDetail,
    ErrorResponse,
    HealthResponse,
    HealthStatus,
    Metadata,
    NonEmptyStr,
    PageInfo,
    SemVer,
    Slug,
    Timestamp,
    VersionResponse,
)
from .conversation import (
    AttachmentRef,
    Conversation,
    ConversationCreate,
    Message,
    MessageCreate,
    MessageRole,
    MessageStatus,
    StreamEvent,
    StreamEventType,
)
from .conversation_feed import (
    ConversationFeed,
    ConversationFeedItem,
)
from .conversation_stats import (
    ConversationStats,
    RoleMessageCount,
    StatusMessageCount,
)
from .conversation_overview import (
    ConversationOverview,
    ConversationOverviewCounts,
)
from .collaboration_stats import (
    CollaborationProjectCount,
    CollaborationStats,
    PresenceStateCount,
)
from .collaboration_feed import (
    CollaborationFeed,
    CollaborationFeedItem,
    CollaborationSignal,
)
from .comment_feed import (
    CommentFeed,
    CommentFeedItem,
)
from .comment_stats import (
    CommentAuthorCount,
    CommentProjectCount,
    CommentReference,
    CommentReferenceCount,
    CommentStats,
)
from .operation import (
    Job,
    JobCancelRequest,
    JobError,
    JobEvent,
    JobEventFrame,
    JobEventType,
    JobListQuery,
    JobResult,
    JobRetryRequest,
    JobStatus,
    OperationCatalog,
    OperationIO,
    OperationRequest,
    OperationSetting,
    OperationSpec,
    SettingType,
)
from .operation_feed import (
    OperationFeed,
    OperationFeedItem,
)
from .operation_stats import (
    OperationStats,
    OperationTypeCount,
)
from .organization_feed import (
    OrganizationFeed,
    OrganizationFeedItem,
)
from .organization_stats import (
    OrganizationMemberCount,
    OrganizationStats,
    RoleMemberCount,
)
from .pipeline_stats import (
    PipelineKind,
    PipelineKindStats,
    PipelineProjectCount,
    PipelineStats,
)
from .pipeline_feed import (
    PipelineFeed,
    PipelineFeedItem,
)
from .orchestration import (
    Comment,
    OrchestrationPlan,
    OrchestrationPlanStep,
    OrchestrationRun,
    OrchestrationRunRequest,
    OrchestrationStage,
    Presence,
    PresenceState,
    StorageQuota,
    StorageQuotaUnit,
    StorageStats,
)
from .orchestration_feed import (
    OrchestrationFeed,
    OrchestrationFeedItem,
    OrchestrationFeedKind,
)
from .orchestration_stats import (
    OrchestrationProjectCount,
    OrchestrationStageCount,
    OrchestrationStats,
)
from .project_feed import (
    ProjectFeed,
    ProjectFeedItem,
)
from .project_stats import (
    ProjectLifecycle,
    ProjectLifecycleCount,
    ProjectStats,
)
from .project_overview import (
    ProjectOverview,
    ProjectOverviewCounts,
)
from .provider_feed import (
    ProviderFeed,
    ProviderFeedItem,
)
from .provider_overview import (
    ProviderOverview,
    ProviderOverviewCounts,
    ProviderOverviewOperation,
)
from .provider_stats import (
    ProviderLocationCount,
    ProviderOperationStat,
    ProviderStats,
    ProviderStatusCount,
)
from .publish_feed import (
    PublishFeed,
    PublishFeedItem,
)
from .publish_stats import (
    PublishProjectCount,
    PublishStats,
    PublishVersionCount,
)
from .retry_feed import (
    RetryFeed,
    RetryFeedItem,
)
from .retry_stats import (
    RetryProjectCount,
    RetryStats,
    RetryStatusCount,
)
from .provider import (
    CapabilityQuery,
    Extension,
    ExtensionDependency,
    ExtensionInstallRequest,
    ExtensionInstallResult,
    ExtensionManifest,
    ExtensionPermission,
    ExtensionRequirements,
    ExtensionStatus,
    ExtensionType,
    Provider,
    ProviderCapability,
    ProviderLocation,
    ProviderStatus,
)
from .search import (
    SearchResponse,
    SearchResult,
    SearchResultKind,
)
from .search_stats import (
    SearchKindCount,
    SearchStats,
)
from .tags import (
    TagFacet,
    TagIndex,
)
from .upload_feed import (
    UploadFeed,
    UploadFeedItem,
)
from .upload_stats import (
    UploadProjectCount,
    UploadStats,
    UploadStatus,
    UploadStatusCount,
)
from .version_feed import (
    VersionFeed,
    VersionFeedItem,
)
from .version_stats import (
    VersionNumberCount,
    VersionProjectCount,
    VersionStats,
)

__all__ = [
    "API_PREFIX",
    "API_VERSION",
    # activity
    "ActivityEvent",
    "ActivityFeed",
    "ActivityKind",
    "ActivityTone",
    # activity stats
    "ActivityKindCount",
    "ActivityProjectCount",
    "ActivityStats",
    # dashboard
    "DashboardCounts",
    "DashboardSummary",
    # event feed
    "EventFeed",
    "EventFeedItem",
    # event stats
    "EventJobCount",
    "EventStats",
    "EventTypeCount",
    # extension feed
    "ExtensionFeed",
    "ExtensionFeedItem",
    # extension overview
    "ExtensionOverview",
    "ExtensionOverviewCounts",
    # extension stats
    "ExtensionPermissionStat",
    "ExtensionStats",
    "ExtensionStatusCount",
    "ExtensionTypeCount",
    # impact
    "AssetImpact",
    "ImpactNode",
    # lineage feed
    "LineageFeed",
    "LineageFeedItem",
    # lineage stats
    "LineageProjectCount",
    "LineageStats",
    "LineageTypeCount",
    # job stats
    "JobStats",
    "JobStatusCount",
    "OperationJobStat",
    # job feed
    "JobFeed",
    "JobFeedItem",
    # job overview
    "JobOverview",
    "JobOverviewCounts",
    # job logs
    "JobLogEntry",
    "JobLogFrame",
    "LogLevel",
    # job queue
    "JobQueueEntry",
    "JobQueueView",
    # audit
    "AuditEvent",
    "AuditEventKind",
    "AuditTone",
    "AuditTrail",
    # asset feed
    "AssetFeed",
    "AssetFeedItem",
    # asset stats
    "AssetStats",
    "AssetStatusCount",
    "AssetTypeCount",
    # asset
    "Asset",
    "AssetLineage",
    "AssetLineageNode",
    "AssetProps",
    "AssetRegisterRequest",
    "AssetRelationship",
    "AssetStatus",
    "AssetType",
    "AssetUpdate",
    "AssetVersion",
    "AssetVersionCreate",
    "AssetVersionCreateRequest",
    "AssetVersionRegisterRequest",
    "AssetVersionRequest",
    "CreateAssetVersionRequest",
    "DownloadTicket",
    "Provenance",
    "RelationshipType",
    "StorageRef",
    "UploadRequest",
    "UploadTicket",
    # asset overview
    "AssetOverview",
    "AssetOverviewCounts",
    # project feed
    "ProjectFeed",
    "ProjectFeedItem",
    # project stats
    "ProjectLifecycle",
    "ProjectLifecycleCount",
    "ProjectStats",
    # project overview
    "ProjectOverview",
    "ProjectOverviewCounts",
    # provider feed
    "ProviderFeed",
    "ProviderFeedItem",
    # provider overview
    "ProviderOverview",
    "ProviderOverviewCounts",
    "ProviderOverviewOperation",
    # provider stats
    "ProviderLocationCount",
    "ProviderOperationStat",
    "ProviderStats",
    "ProviderStatusCount",
    # publish feed
    "PublishFeed",
    "PublishFeedItem",
    # publish stats
    "PublishProjectCount",
    "PublishStats",
    "PublishVersionCount",
    # auth
    "LoginRequest",
    "Member",
    "MemberInvite",
    "MemberRole",
    "Organization",
    "OrganizationCreate",
    "Project",
    "ProjectCreate",
    "ProjectUpdate",
    "RefreshRequest",
    "SessionResponse",
    "TokenPair",
    "User",
    # common
    "ContractModel",
    "Email",
    "Empty",
    "ErrorBody",
    "ErrorDetail",
    "ErrorResponse",
    "HealthResponse",
    "HealthStatus",
    "Metadata",
    "NonEmptyStr",
    "PageInfo",
    "SemVer",
    "Slug",
    "Timestamp",
    "VersionResponse",
    # conversation
    "AttachmentRef",
    "Conversation",
    "ConversationCreate",
    "Message",
    "MessageCreate",
    "MessageRole",
    "MessageStatus",
    "StreamEvent",
    "StreamEventType",
    # conversation feed
    "ConversationFeed",
    "ConversationFeedItem",
    # conversation stats
    "ConversationStats",
    "RoleMessageCount",
    "StatusMessageCount",
    # conversation overview
    "ConversationOverview",
    "ConversationOverviewCounts",
    # collaboration stats
    "CollaborationProjectCount",
    "CollaborationStats",
    "PresenceStateCount",
    # collaboration feed
    "CollaborationFeed",
    "CollaborationFeedItem",
    "CollaborationSignal",
    # comment feed
    "CommentFeed",
    "CommentFeedItem",
    # comment stats
    "CommentAuthorCount",
    "CommentProjectCount",
    "CommentReference",
    "CommentReferenceCount",
    "CommentStats",
    # operation
    "Job",
    "JobCancelRequest",
    "JobError",
    "JobEvent",
    "JobEventFrame",
    "JobEventType",
    "JobListQuery",
    "JobResult",
    "JobRetryRequest",
    "JobStatus",
    "OperationCatalog",
    "OperationIO",
    "OperationRequest",
    "OperationSetting",
    "OperationSpec",
    "SettingType",
    # operation feed
    "OperationFeed",
    "OperationFeedItem",
    # operation stats
    "OperationStats",
    "OperationTypeCount",
    # organization feed
    "OrganizationFeed",
    "OrganizationFeedItem",
    # organization stats
    "OrganizationMemberCount",
    "OrganizationStats",
    "RoleMemberCount",
    # pipeline stats
    "PipelineKind",
    "PipelineKindStats",
    "PipelineProjectCount",
    "PipelineStats",
    # pipeline feed
    "PipelineFeed",
    "PipelineFeedItem",
    # orchestration
    "Comment",
    "OrchestrationPlan",
    "OrchestrationPlanStep",
    "OrchestrationRun",
    "OrchestrationRunRequest",
    "OrchestrationStage",
    "Presence",
    "PresenceState",
    "StorageQuota",
    "StorageQuotaUnit",
    "StorageStats",
    # orchestration feed
    "OrchestrationFeed",
    "OrchestrationFeedItem",
    "OrchestrationFeedKind",
    # orchestration stats
    "OrchestrationProjectCount",
    "OrchestrationStageCount",
    "OrchestrationStats",
    # provider
    "CapabilityQuery",
    "Extension",
    "ExtensionDependency",
    "ExtensionInstallRequest",
    "ExtensionInstallResult",
    "ExtensionManifest",
    "ExtensionPermission",
    "ExtensionRequirements",
    "ExtensionStatus",
    "ExtensionType",
    "Provider",
    "ProviderCapability",
    "ProviderLocation",
    "ProviderStatus",
    # retry feed
    "RetryFeed",
    "RetryFeedItem",
    # retry stats
    "RetryProjectCount",
    "RetryStats",
    "RetryStatusCount",
    # search
    "SearchResponse",
    "SearchResult",
    "SearchResultKind",
    # search stats
    "SearchKindCount",
    "SearchStats",
    # tags
    "TagFacet",
    "TagIndex",
    # upload feed
    "UploadFeed",
    "UploadFeedItem",
    # upload stats
    "UploadStatus",
    "UploadStatusCount",
    "UploadProjectCount",
    "UploadStats",
    # version feed
    "VersionFeed",
    "VersionFeedItem",
    # version stats
    "VersionNumberCount",
    "VersionProjectCount",
    "VersionStats",
]
