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
from .event_stats import (
    EventJobCount,
    EventStats,
    EventTypeCount,
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
from .conversation_stats import (
    ConversationStats,
    RoleMessageCount,
    StatusMessageCount,
)
from .collaboration_stats import (
    CollaborationProjectCount,
    CollaborationStats,
    PresenceStateCount,
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
from .operation_stats import (
    OperationStats,
    OperationTypeCount,
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
from .orchestration_stats import (
    OrchestrationProjectCount,
    OrchestrationStageCount,
    OrchestrationStats,
)
from .project_stats import (
    ProjectLifecycle,
    ProjectLifecycleCount,
    ProjectStats,
)
from .provider_stats import (
    ProviderLocationCount,
    ProviderOperationStat,
    ProviderStats,
    ProviderStatusCount,
)
from .publish_stats import (
    PublishProjectCount,
    PublishStats,
    PublishVersionCount,
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
from .upload_stats import (
    UploadProjectCount,
    UploadStats,
    UploadStatus,
    UploadStatusCount,
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
    # event stats
    "EventJobCount",
    "EventStats",
    "EventTypeCount",
    # extension stats
    "ExtensionPermissionStat",
    "ExtensionStats",
    "ExtensionStatusCount",
    "ExtensionTypeCount",
    # impact
    "AssetImpact",
    "ImpactNode",
    # lineage stats
    "LineageProjectCount",
    "LineageStats",
    "LineageTypeCount",
    # job stats
    "JobStats",
    "JobStatusCount",
    "OperationJobStat",
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
    # project stats
    "ProjectLifecycle",
    "ProjectLifecycleCount",
    "ProjectStats",
    # provider stats
    "ProviderLocationCount",
    "ProviderOperationStat",
    "ProviderStats",
    "ProviderStatusCount",
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
    # conversation stats
    "ConversationStats",
    "RoleMessageCount",
    "StatusMessageCount",
    # collaboration stats
    "CollaborationProjectCount",
    "CollaborationStats",
    "PresenceStateCount",
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
    # operation stats
    "OperationStats",
    "OperationTypeCount",
    # organization stats
    "OrganizationMemberCount",
    "OrganizationStats",
    "RoleMemberCount",
    # pipeline stats
    "PipelineKind",
    "PipelineKindStats",
    "PipelineProjectCount",
    "PipelineStats",
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
    # upload stats
    "UploadStatus",
    "UploadStatusCount",
    "UploadProjectCount",
    "UploadStats",
    # version stats
    "VersionNumberCount",
    "VersionProjectCount",
    "VersionStats",
]
