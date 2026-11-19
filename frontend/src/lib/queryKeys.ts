import type { ActivityOptions } from "./activity";
import type { ActivityStatsOptions } from "./activityStats";
import type { AssetFeedOptions } from "./assetFeed";
import type { AssetStatsOptions } from "./assetStats";
import type { AuditQuery } from "./audit";
import type { CollaborationStatsOptions } from "./collaborationStats";
import type { ConversationFeedOptions } from "./conversationFeed";
import type { ConversationStatsOptions } from "./conversationStats";
import type { DashboardOptions } from "./dashboard";
import type { EventStatsOptions } from "./eventStats";
import type { ExtensionStatsOptions } from "./extensionStats";
import type { ImpactOptions } from "./impact";
import type { JobLogsOptions } from "./jobLogs";
import type { JobQueueOptions } from "./jobQueue";
import type { JobStatsOptions } from "./jobStats";
import type { LineageStatsOptions } from "./lineageStats";
import type { OrganizationStatsOptions } from "./organizationStats";
import type { OrchestrationStatsOptions } from "./orchestrationStats";
import type { PipelineStatsOptions } from "./pipelineStats";
import type { ProjectStatsOptions } from "./projectStats";
import type { ProviderStatsOptions } from "./providerStats";
import type { PublishFeedOptions } from "./publishFeed";
import type { PublishStatsOptions } from "./publishStats";
import type { RetryStatsOptions } from "./retryStats";
import type { SearchOptions } from "./search";
import type { SearchStatsOptions } from "./searchStats";
import type { TagOptions } from "./tags";
import type { UploadFeedOptions } from "./uploadFeed";
import type { UploadStatsOptions } from "./uploadStats";
import type { VersionStatsOptions } from "./versionStats";

/**
 * Centralised TanStack Query keys.
 *
 * Query keys are part of the module contract (used for caching and
 * invalidation), so they live in one place and are built by helpers rather
 * than inlined at call sites.
 */
export const queryKeys = {
  home: {
    summary: () => ["home", "summary"] as const,
  },
  activity: {
    feed: (options: ActivityOptions = {}) =>
      [
        "activity",
        "feed",
        options.projectId ?? "all",
        options.kind ?? "all",
        options.limit ?? "all",
      ] as const,
  },
  activityStats: {
    summary: (options: ActivityStatsOptions = {}) =>
      ["activity-stats", "summary", options.projectId ?? "all"] as const,
  },
  dashboard: {
    summary: (options: DashboardOptions = {}) =>
      ["dashboard", "summary", options.recentLimit ?? "all"] as const,
  },
  jobStats: {
    summary: (options: JobStatsOptions = {}) =>
      ["job-stats", "summary", options.projectId ?? "all"] as const,
  },
  assetStats: {
    summary: (options: AssetStatsOptions = {}) =>
      ["asset-stats", "summary", options.projectId ?? "all"] as const,
  },
  assetFeed: {
    feed: (options: AssetFeedOptions = {}) =>
      ["asset-feed", "feed", options.projectId ?? "all", options.limit ?? "all"] as const,
  },
  conversationStats: {
    summary: (options: ConversationStatsOptions = {}) =>
      ["conversation-stats", "summary", options.projectId ?? "all"] as const,
  },
  conversationFeed: {
    feed: (options: ConversationFeedOptions = {}) =>
      ["conversation-feed", "feed", options.projectId ?? "all", options.limit ?? "all"] as const,
  },
  projectStats: {
    summary: (options: ProjectStatsOptions = {}) =>
      ["project-stats", "summary", options.orgId ?? "all"] as const,
  },
  providerStats: {
    summary: (options: ProviderStatsOptions = {}) =>
      [
        "provider-stats",
        "summary",
        options.location ?? "all",
        options.status ?? "all",
      ] as const,
  },
  extensionStats: {
    summary: (options: ExtensionStatsOptions = {}) =>
      ["extension-stats", "summary", options.type ?? "all", options.status ?? "all"] as const,
  },
  organizationStats: {
    summary: (options: OrganizationStatsOptions = {}) =>
      ["organization-stats", "summary", options.orgId ?? "all"] as const,
  },
  pipelineStats: {
    summary: (options: PipelineStatsOptions = {}) =>
      ["pipeline-stats", "summary", options.projectId ?? "all"] as const,
  },
  lineageStats: {
    summary: (options: LineageStatsOptions = {}) =>
      ["lineage-stats", "summary", options.projectId ?? "all"] as const,
  },
  collaborationStats: {
    summary: (options: CollaborationStatsOptions = {}) =>
      ["collaboration-stats", "summary", options.projectId ?? "all"] as const,
  },
  orchestrationStats: {
    summary: (options: OrchestrationStatsOptions = {}) =>
      ["orchestration-stats", "summary", options.projectId ?? "all"] as const,
  },
  projects: {
    all: () => ["projects"] as const,
    byId: (id: string) => ["projects", "by-id", id] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  assets: {
    all: () => ["assets"] as const,
    byId: (id: string) => ["assets", "by-id", id] as const,
    recent: (limit: number) => ["assets", "recent", limit] as const,
    byProject: (projectId: string) => ["assets", "by-project", projectId] as const,
    workflowTemplates: (projectId?: string) =>
      ["assets", "workflow-templates", projectId ?? "all"] as const,
  },
  /** Cache roots refreshed after an asset write; TanStack matches by prefix. */
  assetWriteRoots: () =>
    [["assets"], ["home"], ["projects"]] as const,
  jobs: {
    all: () => ["jobs"] as const,
    byId: (id: string) => ["jobs", "by-id", id] as const,
    byProject: (projectId: string) => ["jobs", "by-project", projectId] as const,
    list: (params: { projectId?: string; status?: string } = {}) =>
      ["jobs", "list", params] as const,
  },
  jobLogs: {
    frame: (jobId: string, options: JobLogsOptions = {}) =>
      [
        "job-logs",
        "frame",
        jobId,
        options.level ?? "all",
        options.sinceSeq ?? 0,
        options.limit ?? 50,
      ] as const,
  },
  jobQueue: {
    view: (options: JobQueueOptions = {}) =>
      ["job-queue", "view", options.projectId ?? "all", options.limit ?? "all"] as const,
  },
  providers: {
    all: () => ["providers"] as const,
    byId: (id: string) => ["providers", "by-id", id] as const,
  },
  operations: {
    catalog: () => ["operations", "catalog"] as const,
  },
  operationStats: {
    summary: () => ["operation-stats", "summary"] as const,
  },
  capabilities: {
    list: (operationId?: string) =>
      ["capabilities", "list", operationId ?? "all"] as const,
  },
  conversations: {
    byProject: (projectId: string) => ["conversations", "by-project", projectId] as const,
    byId: (id: string) => ["conversations", "by-id", id] as const,
  },
  messages: {
    all: () => ["messages"] as const,
    byConversation: (conversationId: string, limit?: number) =>
      ["messages", "by-conversation", conversationId, limit ?? "all"] as const,
  },
  auth: {
    me: () => ["auth", "me"] as const,
    organizations: () => ["auth", "organizations"] as const,
  },
  orchestration: {
    run: (runId: string) => ["orchestration", "run", runId] as const,
  },
  collaboration: {
    presence: (projectId: string) => ["collaboration", "presence", projectId] as const,
    comments: (projectId: string, assetId?: string) =>
      ["collaboration", "comments", projectId, assetId ?? "all"] as const,
  },
  storage: {
    stats: (projectId: string) => ["storage", "stats", projectId] as const,
  },
  audit: {
    trail: (projectId: string, query: AuditQuery = {}) =>
      [
        "audit",
        "trail",
        projectId,
        query.kind ?? "all",
        query.since ?? "all",
        query.until ?? "all",
        query.limit ?? "all",
      ] as const,
  },
  extensions: {
    all: () => ["extensions"] as const,
    byId: (extensionId: string) => ["extensions", "by-id", extensionId] as const,
  },
  search: {
    results: (query: string, options: SearchOptions = {}) =>
      ["search", "results", query, options.kind ?? "all", options.limit ?? "all"] as const,
  },
  searchStats: {
    summary: (options: SearchStatsOptions = {}) =>
      ["search-stats", "summary", options.projectId ?? "all"] as const,
  },
  uploadStats: {
    summary: (options: UploadStatsOptions = {}) =>
      ["upload-stats", "summary", options.projectId ?? "all"] as const,
  },
  uploadFeed: {
    feed: (options: UploadFeedOptions = {}) =>
      ["upload-feed", "feed", options.projectId ?? "all", options.limit ?? "all"] as const,
  },
  eventStats: {
    summary: (options: EventStatsOptions = {}) =>
      ["event-stats", "summary", options.projectId ?? "all"] as const,
  },
  retryStats: {
    summary: (options: RetryStatsOptions = {}) =>
      ["retry-stats", "summary", options.projectId ?? "all"] as const,
  },
  versionStats: {
    summary: (options: VersionStatsOptions = {}) =>
      ["version-stats", "summary", options.projectId ?? "all"] as const,
  },
  publishStats: {
    summary: (options: PublishStatsOptions = {}) =>
      ["publish-stats", "summary", options.projectId ?? "all"] as const,
  },
  publishFeed: {
    feed: (options: PublishFeedOptions = {}) =>
      ["publish-feed", "feed", options.projectId ?? "all", options.limit ?? "all"] as const,
  },
  tags: {
    index: (options: TagOptions = {}) =>
      [
        "tags",
        "index",
        options.projectId ?? "all",
        options.prefix ?? "all",
        options.limit ?? "all",
      ] as const,
  },
  impact: {
    asset: (assetId: string, options: ImpactOptions = {}) =>
      ["impact", "asset", assetId, options.maxDepth ?? "all"] as const,
  },
} as const;
