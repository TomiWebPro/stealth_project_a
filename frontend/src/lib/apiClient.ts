import type { ActivityOptions } from "./activity";
import type { ActivityStatsOptions } from "./activityStats";
import type { AssetFeedOptions } from "./assetFeed";
import type { AssetOverviewOptions } from "./assetOverview";
import type { AssetStatsOptions } from "./assetStats";
import type { AuditQuery } from "./audit";
import type { CapabilityMatch } from "./catalog";
import type { CollaborationFeedOptions } from "./collaborationFeed";
import type { CollaborationStatsOptions } from "./collaborationStats";
import type { CommentStatsOptions } from "./commentStats";
import type { CommentFeedOptions } from "./commentFeed";
import type { ConversationFeedOptions } from "./conversationFeed";
import type { ConversationStatsOptions } from "./conversationStats";
import type { ConversationStream } from "./conversationStream";
export type { ConversationStream };
import type { DashboardOptions } from "./dashboard";
import type { EventFeedOptions } from "./eventFeed";
import type { EventStatsOptions } from "./eventStats";
import type { ExtensionFeedOptions } from "./extensionFeed";
import type { ExtensionStatsOptions } from "./extensionStats";
import type { HomeSummary } from "./homeSummary";
import type { ImpactOptions } from "./impact";
import type { JobFeedOptions } from "./jobFeed";
import type { JobLogsOptions } from "./jobLogs";
import type { JobQueueOptions } from "./jobQueue";
import type { JobStatsOptions } from "./jobStats";
import type { LineageFeedOptions } from "./lineageFeed";
import type { LineageStatsOptions } from "./lineageStats";
import type { OperationFeedOptions } from "./operationFeed";
import type { OrganizationFeedOptions } from "./organizationFeed";
import type { OrganizationStatsOptions } from "./organizationStats";
import type { OrchestrationStatsOptions } from "./orchestrationStats";
import type { OrchestrationFeedOptions } from "./orchestrationFeed";
import type { PipelineFeedOptions } from "./pipelineFeed";
import type { PipelineStatsOptions } from "./pipelineStats";
import type { ProjectDetail } from "./projectDetail";
import type { ProjectFeedOptions } from "./projectFeed";
import type { ProjectOverviewOptions } from "./projectOverview";
import type { ProjectStatsOptions } from "./projectStats";
import type { ProviderFeedOptions } from "./providerFeed";
import type { ProviderStatsOptions } from "./providerStats";
import type { PublishFeedOptions } from "./publishFeed";
import type { PublishStatsOptions } from "./publishStats";
import type { RetryFeedOptions } from "./retryFeed";
import type { RetryStatsOptions } from "./retryStats";
import type { SearchOptions } from "./search";
import type { SearchStatsOptions } from "./searchStats";
import type { TagOptions } from "./tags";
import type { UploadFeedOptions } from "./uploadFeed";
import type { UploadStatsOptions } from "./uploadStats";
import type { VersionFeedOptions } from "./versionFeed";
import type { VersionStatsOptions } from "./versionStats";
import type {
  ActivityFeed,
  ActivityStats,
  Asset,
  AssetFeed,
  AssetImpact,
  AssetOverview,
  AssetStats,
  AssetUpdate,
  AuditTrail,
  CollaborationFeed,
  CollaborationStats,
  Comment,
  CommentFeed,
  CommentStats,
  Conversation,
  ConversationFeed,
  ConversationStats,
  DashboardSummary,
  EventFeed,
  EventStats,
  Extension,
  ExtensionFeed,
  ExtensionStats,
  Job,
  JobFeed,
  JobLogFrame,
  JobQueueView,
  JobStats,
  LineageFeed,
  LineageStats,
  Message,
  MessageCreate,
  OperationCatalog,
  OperationFeed,
  OperationStats,
  Organization,
  OrganizationFeed,
  OrganizationStats,
  OrchestrationFeed,
  OrchestrationRun,
  OrchestrationStats,
  PipelineFeed,
  PipelineStats,
  Presence,
  Project,
  ProjectFeed,
  ProjectOverview,
  ProjectStats,
  Provider,
  ProviderFeed,
  ProviderStats,
  PublishFeed,
  PublishStats,
  RetryFeed,
  RetryStats,
  SearchResponse,
  SearchStats,
  StorageStats,
  TagIndex,
  UploadFeed,
  UploadStats,
  User,
  VersionFeed,
  VersionStats,
} from "./types";
import * as mockApi from "./mock/mockApi";

/**
 * Mock API client facade.
 *
 * Screens and query hooks depend on this interface only. A live HTTP client
 * implementing the same shape (against `src/api`) can be dropped in without
 * touching consumers. Payload types come from the shared contracts in
 * `src/types`; `HomeSummary` / `ProjectDetail` are assembled view models.
 */
export interface ApiClient {
  getHomeSummary(): Promise<HomeSummary>;
  /**
   * Newest-first authoritative workspace activity feed (C29). An unknown
   * `projectId` scope surfaces a normalized 404 `ApiError` on both transports.
   */
  getActivity(options?: ActivityOptions): Promise<ActivityFeed>;
  /** Authoritative activity metrics derived by `/activity/stats`, optionally project-scoped (C89). */
  getActivityStats(options?: ActivityStatsOptions): Promise<ActivityStats>;
  /** Authoritative workspace snapshot derived by the backend `/dashboard` endpoint (C25). */
  getDashboard(options?: DashboardOptions): Promise<DashboardSummary>;
  /** Authoritative job execution metrics derived by `/jobs/stats`, optionally project-scoped (C40). */
  getJobStats(options?: JobStatsOptions): Promise<JobStats>;
  /** Newest-first authoritative job feed derived by `/jobs/feed`, optionally project/status-scoped (C141). */
  getJobFeed(options?: JobFeedOptions): Promise<JobFeed>;
  /** Authoritative asset inventory metrics derived by `/assets/stats`, optionally project-scoped (C49). */
  getAssetStats(options?: AssetStatsOptions): Promise<AssetStats>;
  /** Newest-first authoritative asset feed derived by `/assets/feed`, optionally project-scoped (C137). */
  getAssetFeed(options?: AssetFeedOptions): Promise<AssetFeed>;
  /** Authoritative conversation/message metrics derived by `/conversations/stats`, optionally project-scoped (C45). */
  getConversationStats(options?: ConversationStatsOptions): Promise<ConversationStats>;
  /** Newest-first authoritative conversation feed derived by `/conversations/feed`, optionally project-scoped (C133). */
  getConversationFeed(options?: ConversationFeedOptions): Promise<ConversationFeed>;
  /** Newest-first authoritative comment feed derived by `/comments/feed`, optionally project-scoped (C149). */
  getCommentFeed(options?: CommentFeedOptions): Promise<CommentFeed>;
  /** Authoritative comment metrics derived by `/comments/stats`, optionally project-scoped (C165). */
  getCommentStats(options?: CommentStatsOptions): Promise<CommentStats>;
  /** Authoritative project portfolio metrics derived by `/projects/stats`, optionally org-scoped (C53). */
  getProjectStats(options?: ProjectStatsOptions): Promise<ProjectStats>;
  /** Newest-first authoritative project feed derived by `/projects/feed`, optionally org/lifecycle-scoped (C145). */
  getProjectFeed(options?: ProjectFeedOptions): Promise<ProjectFeed>;
  /** Authoritative provider fleet metrics derived by `/providers/stats`, optionally filtered (C57). */
  getProviderStats(options?: ProviderStatsOptions): Promise<ProviderStats>;
  /** Deterministic authoritative provider feed derived by `/providers/feed`, optionally filtered/limited (C185). */
  getProviderFeed(options?: ProviderFeedOptions): Promise<ProviderFeed>;
  /** Authoritative extension registry/installation metrics derived by `/extensions/stats`, optionally filtered (C61). */
  getExtensionStats(options?: ExtensionStatsOptions): Promise<ExtensionStats>;
  /** Newest-first authoritative extension installation feed derived by `/extensions/feed`, optionally filtered/limited (C173). */
  getExtensionFeed(options?: ExtensionFeedOptions): Promise<ExtensionFeed>;
  /** Newest-first authoritative organization feed derived by `/orgs/feed`, with joined member/project counts (C161). */
  getOrganizationFeed(options?: OrganizationFeedOptions): Promise<OrganizationFeed>;
  /** Authoritative organization/membership metrics derived by `/orgs/stats`, optionally org-scoped (C69). */
  getOrganizationStats(options?: OrganizationStatsOptions): Promise<OrganizationStats>;
  /** Authoritative production-pipeline metrics derived by `/pipelines/stats`, optionally project-scoped (C73). */
  getPipelineStats(options?: PipelineStatsOptions): Promise<PipelineStats>;
  /** Newest-first authoritative production-pipeline feed derived by `/pipelines/feed`, optionally project/kind-scoped (C177). */
  getPipelineFeed(options?: PipelineFeedOptions): Promise<PipelineFeed>;
  /** Authoritative asset-lineage metrics derived by `/lineage/stats`, optionally project-scoped (C77). */
  getLineageStats(options?: LineageStatsOptions): Promise<LineageStats>;
  /** Newest-first authoritative asset lineage feed derived by `/lineage/feed`, optionally project-scoped (C157). */
  getLineageFeed(options?: LineageFeedOptions): Promise<LineageFeed>;
  /** Authoritative collaboration metrics derived by `/collaboration/stats`, optionally project-scoped (C81). */
  getCollaborationStats(options?: CollaborationStatsOptions): Promise<CollaborationStats>;
  /** Newest-first authoritative collaboration feed derived by `/collaboration/feed`, optionally project/signal-scoped (C197). */
  getCollaborationFeed(options?: CollaborationFeedOptions): Promise<CollaborationFeed>;
  /** Authoritative orchestration metrics derived by `/orchestration/stats`, optionally project-scoped (C85). */
  getOrchestrationStats(options?: OrchestrationStatsOptions): Promise<OrchestrationStats>;
  /** Newest-first authoritative orchestration feed derived by `/orchestration/feed`, optionally project/kind-scoped (C181). */
  getOrchestrationFeed(options?: OrchestrationFeedOptions): Promise<OrchestrationFeed>;
  listProjects(): Promise<readonly Project[]>;
  getProject(projectId: string): Promise<Project | undefined>;
  listAssets(): Promise<readonly Asset[]>;
  getAsset(assetId: string): Promise<Asset | undefined>;
  /** Persist an asset metadata patch through `PATCH /assets/{id}`. */
  updateAsset(assetId: string, body: AssetUpdate): Promise<Asset>;
  listRecentAssets(limit?: number): Promise<readonly Asset[]>;
  listAssetsByProject(projectId: string): Promise<readonly Asset[]>;
  listJobs(projectId?: string, status?: Job["status"]): Promise<readonly Job[]>;
  listJobsByProject(projectId: string): Promise<readonly Job[]>;
  getJob(jobId: string): Promise<Job | undefined>;
  /**
   * Chronological, severity-filtered, cursor-paginated console log derived from
   * a job's event stream (C117). Unknown jobs resolve to `undefined`, matching
   * the live 404-to-undefined detail-lookup mapping.
   */
  getJobLogs(jobId: string, options?: JobLogsOptions): Promise<JobLogFrame | undefined>;
  /**
   * Authoritative active (queued + running) dispatch queue in FIFO order with
   * whole-queue counters and a bounded, position-labelled page (C121).
   */
  getJobQueue(options?: JobQueueOptions): Promise<JobQueueView>;
  getProjectDetail(projectId: string): Promise<ProjectDetail | undefined>;
  /**
   * Authoritative single-asset snapshot (identity, published flag, cross-domain
   * counts and a bounded newest-version list) from `/assets/{id}/overview`;
   * unknown assets resolve to `undefined` (C205).
   */
  getAssetOverview(
    assetId: string,
    options?: AssetOverviewOptions,
  ): Promise<AssetOverview | undefined>;
  /**
   * Authoritative single-project snapshot (identity, cross-domain counts and a
   * bounded newest-first jobs/assets list) from `/projects/{id}/overview`;
   * unknown projects resolve to `undefined` (C201).
   */
  getProjectOverview(
    projectId: string,
    options?: ProjectOverviewOptions,
  ): Promise<ProjectOverview | undefined>;
  /** Newest-first authoritative audit feed; unknown projects resolve to undefined. */
  getProjectAudit(projectId: string, query?: AuditQuery): Promise<AuditTrail | undefined>;
  listProviders(): Promise<readonly Provider[]>;
  getProvider(providerId: string): Promise<Provider | undefined>;
  listWorkflowTemplates(projectId?: string): Promise<readonly Asset[]>;
  /** Static operation catalog (pipeline stages 1-9). */
  getOperations(): Promise<OperationCatalog>;
  /** Deterministic authoritative operation feed derived by `/operations/feed`, optionally filtered/limited (C189). */
  getOperationFeed(options?: OperationFeedOptions): Promise<OperationFeed>;
  /** Authoritative catalog metrics derived by `/operations/stats` (C65). */
  getOperationStats(): Promise<OperationStats>;
  /** Flattened provider capability rows, optionally filtered by operation id. */
  listCapabilities(operationId?: string): Promise<readonly CapabilityMatch[]>;
  listConversations(projectId: string): Promise<readonly Conversation[]>;
  getConversation(conversationId: string): Promise<Conversation | undefined>;
  listMessages(conversationId: string, limit?: number): Promise<readonly Message[]>;
  /** Persist a message through the conversations write API. */
  sendMessage(conversationId: string, body: MessageCreate): Promise<Message>;
  /** Open a resumable, transport-agnostic conversation event stream. */
  openConversationStream(conversationId: string, resumeFrom?: number): ConversationStream;
  getCurrentUser(): Promise<User>;
  listOrganizations(): Promise<readonly Organization[]>;
  getOrchestrationRun(runId: string): Promise<OrchestrationRun | undefined>;
  listPresence(projectId: string): Promise<readonly Presence[]>;
  listComments(projectId: string, assetId?: string): Promise<readonly Comment[]>;
  getStorageStats(projectId: string): Promise<StorageStats>;
  listExtensions(): Promise<readonly Extension[]>;
  getExtension(extensionId: string): Promise<Extension | undefined>;
  /** Ranked cross-domain (project/asset/conversation) matches (C22). */
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;
  /** Authoritative search-index metrics derived by `/search/stats`, optionally project-scoped (C93). */
  getSearchStats(options?: SearchStatsOptions): Promise<SearchStats>;
  /** Authoritative upload-ticket metrics derived by `/uploads/stats`, optionally project-scoped (C97). */
  getUploadStats(options?: UploadStatsOptions): Promise<UploadStats>;
  /** Newest-first authoritative upload-ticket feed derived by `/uploads/feed`, optionally project-scoped (C129). */
  getUploadFeed(options?: UploadFeedOptions): Promise<UploadFeed>;
  /** Authoritative job event stream metrics derived by `/events/stats`, optionally project-scoped (C101). */
  getEventStats(options?: EventStatsOptions): Promise<EventStats>;
  /** Newest-first authoritative job event feed derived by `/events/feed`, optionally project/type-scoped (C169). */
  getEventFeed(options?: EventFeedOptions): Promise<EventFeed>;
  /** Authoritative job retry metrics derived by `/retries/stats`, optionally project-scoped (C105). */
  getRetryStats(options?: RetryStatsOptions): Promise<RetryStats>;
  /** Newest-first authoritative job retry feed derived by `/retries/feed`, optionally project-scoped (C193). */
  getRetryFeed(options?: RetryFeedOptions): Promise<RetryFeed>;
  /** Authoritative asset version metrics derived by `/versions/stats`, optionally project-scoped (C109). */
  getVersionStats(options?: VersionStatsOptions): Promise<VersionStats>;
  /** Newest-first authoritative asset version feed derived by `/versions/feed`, optionally project-scoped (C153). */
  getVersionFeed(options?: VersionFeedOptions): Promise<VersionFeed>;
  /** Authoritative publish-receipt metrics derived by `/publishes/stats`, optionally project-scoped (C113). */
  getPublishStats(options?: PublishStatsOptions): Promise<PublishStats>;
  /** Newest-first authoritative publish feed derived by `/publishes`, optionally project-scoped (C125). */
  getPublishFeed(options?: PublishFeedOptions): Promise<PublishFeed>;
  /** Most-used-first asset tag facets, optionally scoped/filtered (C33). */
  getTags(options?: TagOptions): Promise<TagIndex>;
  /** Transitive downstream asset impact; unknown roots resolve to undefined (C34). */
  getAssetImpact(assetId: string, options?: ImpactOptions): Promise<AssetImpact | undefined>;
}

/** In-memory implementation of {@link ApiClient} backed by `lib/mock`. */
export const mockApiClient: ApiClient = {
  getHomeSummary: mockApi.fetchHomeSummary,
  getActivity: mockApi.fetchActivity,
  getActivityStats: mockApi.fetchActivityStats,
  getDashboard: mockApi.fetchDashboard,
  getJobStats: mockApi.fetchJobStats,
  getJobFeed: mockApi.fetchJobFeed,
  getAssetStats: mockApi.fetchAssetStats,
  getAssetFeed: mockApi.fetchAssetFeed,
  getConversationStats: mockApi.fetchConversationStats,
  getConversationFeed: mockApi.fetchConversationFeed,
  getCommentFeed: mockApi.fetchCommentFeed,
  getCommentStats: mockApi.fetchCommentStats,
  getProjectStats: mockApi.fetchProjectStats,
  getProjectFeed: mockApi.fetchProjectFeed,
  getProviderStats: mockApi.fetchProviderStats,
  getProviderFeed: mockApi.fetchProviderFeed,
  getExtensionStats: mockApi.fetchExtensionStats,
  getExtensionFeed: mockApi.fetchExtensionFeed,
  getOrganizationFeed: mockApi.fetchOrganizationFeed,
  getOrganizationStats: mockApi.fetchOrganizationStats,
  getPipelineStats: mockApi.fetchPipelineStats,
  getPipelineFeed: mockApi.fetchPipelineFeed,
  getLineageStats: mockApi.fetchLineageStats,
  getLineageFeed: mockApi.fetchLineageFeed,
  getCollaborationStats: mockApi.fetchCollaborationStats,
  getCollaborationFeed: mockApi.fetchCollaborationFeed,
  getOrchestrationStats: mockApi.fetchOrchestrationStats,
  getOrchestrationFeed: mockApi.fetchOrchestrationFeed,
  listProjects: mockApi.fetchProjects,
  getProject: mockApi.fetchProject,
  listAssets: mockApi.fetchAssets,
  getAsset: mockApi.fetchAsset,
  updateAsset: mockApi.updateAsset,
  listRecentAssets: mockApi.fetchRecentAssets,
  listAssetsByProject: mockApi.fetchAssetsByProject,
  listJobs: mockApi.fetchJobs,
  listJobsByProject: mockApi.fetchJobsByProject,
  getJob: mockApi.fetchJob,
  getJobLogs: mockApi.fetchJobLogs,
  getJobQueue: mockApi.fetchJobQueue,
  getProjectDetail: mockApi.fetchProjectDetail,
  getAssetOverview: mockApi.fetchAssetOverview,
  getProjectOverview: mockApi.fetchProjectOverview,
  getProjectAudit: mockApi.fetchProjectAudit,
  listProviders: mockApi.fetchProviders,
  getProvider: mockApi.fetchProvider,
  listWorkflowTemplates: mockApi.fetchWorkflowTemplates,
  getOperations: mockApi.fetchOperations,
  getOperationFeed: mockApi.fetchOperationFeed,
  getOperationStats: mockApi.fetchOperationStats,
  listCapabilities: mockApi.fetchCapabilities,
  listConversations: mockApi.fetchConversations,
  getConversation: mockApi.fetchConversation,
  listMessages: mockApi.fetchMessages,
  sendMessage: mockApi.sendMessage,
  openConversationStream: mockApi.openConversationStream,
  getCurrentUser: mockApi.fetchCurrentUser,
  listOrganizations: mockApi.fetchOrganizations,
  getOrchestrationRun: mockApi.fetchOrchestrationRun,
  listPresence: mockApi.fetchPresence,
  listComments: mockApi.fetchComments,
  getStorageStats: mockApi.fetchStorageStats,
  listExtensions: mockApi.fetchExtensions,
  getExtension: mockApi.fetchExtension,
  search: mockApi.fetchSearch,
  getSearchStats: mockApi.fetchSearchStats,
  getUploadStats: mockApi.fetchUploadStats,
  getUploadFeed: mockApi.fetchUploadFeed,
  getEventStats: mockApi.fetchEventStats,
  getEventFeed: mockApi.fetchEventFeed,
  getRetryStats: mockApi.fetchRetryStats,
  getRetryFeed: mockApi.fetchRetryFeed,
  getVersionStats: mockApi.fetchVersionStats,
  getVersionFeed: mockApi.fetchVersionFeed,
  getPublishStats: mockApi.fetchPublishStats,
  getPublishFeed: mockApi.fetchPublishFeed,
  getTags: mockApi.fetchTags,
  getAssetImpact: mockApi.fetchAssetImpact,
};
