import type { ActivityOptions } from "./activity";
import type { AssetStatsOptions } from "./assetStats";
import type { AuditQuery } from "./audit";
import type { CapabilityMatch } from "./catalog";
import type { CollaborationStatsOptions } from "./collaborationStats";
import type { ConversationStatsOptions } from "./conversationStats";
import type { ConversationStream } from "./conversationStream";
export type { ConversationStream };
import type { DashboardOptions } from "./dashboard";
import type { ExtensionStatsOptions } from "./extensionStats";
import type { HomeSummary } from "./homeSummary";
import type { ImpactOptions } from "./impact";
import type { JobStatsOptions } from "./jobStats";
import type { LineageStatsOptions } from "./lineageStats";
import type { OrganizationStatsOptions } from "./organizationStats";
import type { OrchestrationStatsOptions } from "./orchestrationStats";
import type { PipelineStatsOptions } from "./pipelineStats";
import type { ProjectDetail } from "./projectDetail";
import type { ProjectStatsOptions } from "./projectStats";
import type { ProviderStatsOptions } from "./providerStats";
import type { SearchOptions } from "./search";
import type { TagOptions } from "./tags";
import type {
  ActivityFeed,
  Asset,
  AssetImpact,
  AssetStats,
  AssetUpdate,
  AuditTrail,
  CollaborationStats,
  Comment,
  Conversation,
  ConversationStats,
  DashboardSummary,
  Extension,
  ExtensionStats,
  Job,
  JobStats,
  LineageStats,
  Message,
  MessageCreate,
  OperationCatalog,
  OperationStats,
  Organization,
  OrganizationStats,
  OrchestrationRun,
  OrchestrationStats,
  PipelineStats,
  Presence,
  Project,
  ProjectStats,
  Provider,
  ProviderStats,
  SearchResponse,
  StorageStats,
  TagIndex,
  User,
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
  /** Authoritative workspace snapshot derived by the backend `/dashboard` endpoint (C25). */
  getDashboard(options?: DashboardOptions): Promise<DashboardSummary>;
  /** Authoritative job execution metrics derived by `/jobs/stats`, optionally project-scoped (C40). */
  getJobStats(options?: JobStatsOptions): Promise<JobStats>;
  /** Authoritative asset inventory metrics derived by `/assets/stats`, optionally project-scoped (C49). */
  getAssetStats(options?: AssetStatsOptions): Promise<AssetStats>;
  /** Authoritative conversation/message metrics derived by `/conversations/stats`, optionally project-scoped (C45). */
  getConversationStats(options?: ConversationStatsOptions): Promise<ConversationStats>;
  /** Authoritative project portfolio metrics derived by `/projects/stats`, optionally org-scoped (C53). */
  getProjectStats(options?: ProjectStatsOptions): Promise<ProjectStats>;
  /** Authoritative provider fleet metrics derived by `/providers/stats`, optionally filtered (C57). */
  getProviderStats(options?: ProviderStatsOptions): Promise<ProviderStats>;
  /** Authoritative extension registry/installation metrics derived by `/extensions/stats`, optionally filtered (C61). */
  getExtensionStats(options?: ExtensionStatsOptions): Promise<ExtensionStats>;
  /** Authoritative organization/membership metrics derived by `/orgs/stats`, optionally org-scoped (C69). */
  getOrganizationStats(options?: OrganizationStatsOptions): Promise<OrganizationStats>;
  /** Authoritative production-pipeline metrics derived by `/pipelines/stats`, optionally project-scoped (C73). */
  getPipelineStats(options?: PipelineStatsOptions): Promise<PipelineStats>;
  /** Authoritative asset-lineage metrics derived by `/lineage/stats`, optionally project-scoped (C77). */
  getLineageStats(options?: LineageStatsOptions): Promise<LineageStats>;
  /** Authoritative collaboration metrics derived by `/collaboration/stats`, optionally project-scoped (C81). */
  getCollaborationStats(options?: CollaborationStatsOptions): Promise<CollaborationStats>;
  /** Authoritative orchestration metrics derived by `/orchestration/stats`, optionally project-scoped (C85). */
  getOrchestrationStats(options?: OrchestrationStatsOptions): Promise<OrchestrationStats>;
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
  getProjectDetail(projectId: string): Promise<ProjectDetail | undefined>;
  /** Newest-first authoritative audit feed; unknown projects resolve to undefined. */
  getProjectAudit(projectId: string, query?: AuditQuery): Promise<AuditTrail | undefined>;
  listProviders(): Promise<readonly Provider[]>;
  getProvider(providerId: string): Promise<Provider | undefined>;
  listWorkflowTemplates(projectId?: string): Promise<readonly Asset[]>;
  /** Static operation catalog (pipeline stages 1-9). */
  getOperations(): Promise<OperationCatalog>;
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
  /** Most-used-first asset tag facets, optionally scoped/filtered (C33). */
  getTags(options?: TagOptions): Promise<TagIndex>;
  /** Transitive downstream asset impact; unknown roots resolve to undefined (C34). */
  getAssetImpact(assetId: string, options?: ImpactOptions): Promise<AssetImpact | undefined>;
}

/** In-memory implementation of {@link ApiClient} backed by `lib/mock`. */
export const mockApiClient: ApiClient = {
  getHomeSummary: mockApi.fetchHomeSummary,
  getActivity: mockApi.fetchActivity,
  getDashboard: mockApi.fetchDashboard,
  getJobStats: mockApi.fetchJobStats,
  getAssetStats: mockApi.fetchAssetStats,
  getConversationStats: mockApi.fetchConversationStats,
  getProjectStats: mockApi.fetchProjectStats,
  getProviderStats: mockApi.fetchProviderStats,
  getExtensionStats: mockApi.fetchExtensionStats,
  getOrganizationStats: mockApi.fetchOrganizationStats,
  getPipelineStats: mockApi.fetchPipelineStats,
  getLineageStats: mockApi.fetchLineageStats,
  getCollaborationStats: mockApi.fetchCollaborationStats,
  getOrchestrationStats: mockApi.fetchOrchestrationStats,
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
  getProjectDetail: mockApi.fetchProjectDetail,
  getProjectAudit: mockApi.fetchProjectAudit,
  listProviders: mockApi.fetchProviders,
  getProvider: mockApi.fetchProvider,
  listWorkflowTemplates: mockApi.fetchWorkflowTemplates,
  getOperations: mockApi.fetchOperations,
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
  getTags: mockApi.fetchTags,
  getAssetImpact: mockApi.fetchAssetImpact,
};
