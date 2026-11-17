import type { CapabilityMatch } from "./catalog";
import type { ConversationStream } from "./conversationStream";
export type { ConversationStream };
import type { HomeSummary } from "./homeSummary";
import type { ProjectDetail } from "./projectDetail";
import type {
  Asset,
  Comment,
  Conversation,
  Extension,
  Job,
  Message,
  MessageCreate,
  OperationCatalog,
  Organization,
  OrchestrationRun,
  Presence,
  Project,
  Provider,
  StorageStats,
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
  listProjects(): Promise<readonly Project[]>;
  getProject(projectId: string): Promise<Project | undefined>;
  listAssets(): Promise<readonly Asset[]>;
  getAsset(assetId: string): Promise<Asset | undefined>;
  listRecentAssets(limit?: number): Promise<readonly Asset[]>;
  listAssetsByProject(projectId: string): Promise<readonly Asset[]>;
  listJobs(projectId?: string, status?: Job["status"]): Promise<readonly Job[]>;
  listJobsByProject(projectId: string): Promise<readonly Job[]>;
  getJob(jobId: string): Promise<Job | undefined>;
  getProjectDetail(projectId: string): Promise<ProjectDetail | undefined>;
  listProviders(): Promise<readonly Provider[]>;
  getProvider(providerId: string): Promise<Provider | undefined>;
  listWorkflowTemplates(projectId?: string): Promise<readonly Asset[]>;
  /** Static operation catalog (pipeline stages 1-9). */
  getOperations(): Promise<OperationCatalog>;
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
}

/** In-memory implementation of {@link ApiClient} backed by `lib/mock`. */
export const mockApiClient: ApiClient = {
  getHomeSummary: mockApi.fetchHomeSummary,
  listProjects: mockApi.fetchProjects,
  getProject: mockApi.fetchProject,
  listAssets: mockApi.fetchAssets,
  getAsset: mockApi.fetchAsset,
  listRecentAssets: mockApi.fetchRecentAssets,
  listAssetsByProject: mockApi.fetchAssetsByProject,
  listJobs: mockApi.fetchJobs,
  listJobsByProject: mockApi.fetchJobsByProject,
  getJob: mockApi.fetchJob,
  getProjectDetail: mockApi.fetchProjectDetail,
  listProviders: mockApi.fetchProviders,
  getProvider: mockApi.fetchProvider,
  listWorkflowTemplates: mockApi.fetchWorkflowTemplates,
  getOperations: mockApi.fetchOperations,
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
};
