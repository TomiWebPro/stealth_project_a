import type { ActivityOptions } from "./activity";
import type { ActivityStatsOptions } from "./activityStats";
import type { AssetFeedOptions } from "./assetFeed";
import type { AssetOverviewOptions } from "./assetOverview";
import type { AssetStatsOptions } from "./assetStats";
import type { AuditQuery } from "./audit";
import type { CollaborationFeedOptions } from "./collaborationFeed";
import type { CollaborationStatsOptions } from "./collaborationStats";
import type { CommentStatsOptions } from "./commentStats";
import type { CommentFeedOptions } from "./commentFeed";
import type { ConversationFeedOptions } from "./conversationFeed";
import type { ConversationOverviewOptions } from "./conversationOverview";
import type { ConversationStatsOptions } from "./conversationStats";
import type { DashboardOptions } from "./dashboard";
import type { EventFeedOptions } from "./eventFeed";
import type { EventStatsOptions } from "./eventStats";
import type { ExtensionFeedOptions } from "./extensionFeed";
import type { ExtensionStatsOptions } from "./extensionStats";
import type { ImpactOptions } from "./impact";
import type { JobFeedOptions } from "./jobFeed";
import type { JobLogsOptions } from "./jobLogs";
import type { JobOverviewOptions } from "./jobOverview";
import type { JobQueueOptions } from "./jobQueue";
import type { JobStatsOptions } from "./jobStats";
import type { LineageFeedOptions } from "./lineageFeed";
import type { LineageStatsOptions } from "./lineageStats";
import type { OperationFeedOptions } from "./operationFeed";
import type { OrganizationFeedOptions } from "./organizationFeed";
import type { OrganizationOverviewOptions } from "./organizationOverview";
import type { OrganizationStatsOptions } from "./organizationStats";
import type { OrchestrationStatsOptions } from "./orchestrationStats";
import type { OrchestrationFeedOptions } from "./orchestrationFeed";
import type { PipelineFeedOptions } from "./pipelineFeed";
import type { PipelineStatsOptions } from "./pipelineStats";
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
  jobFeed: {
    feed: (options: JobFeedOptions = {}) =>
      [
        "job-feed",
        "feed",
        options.projectId ?? "all",
        options.status ?? "all",
        options.limit ?? "all",
      ] as const,
  },
  jobOverview: {
    detail: (jobId: string, options: JobOverviewOptions = {}) =>
      ["job-overview", "detail", jobId, options.recentLimit ?? "all"] as const,
  },
  assetOverview: {
    detail: (assetId: string, options: AssetOverviewOptions = {}) =>
      ["asset-overview", "detail", assetId, options.recentLimit ?? "all"] as const,
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
  conversationOverview: {
    detail: (conversationId: string, options: ConversationOverviewOptions = {}) =>
      ["conversation-overview", "detail", conversationId, options.recentLimit ?? "all"] as const,
  },
  commentFeed: {
    feed: (options: CommentFeedOptions = {}) =>
      ["comment-feed", "feed", options.projectId ?? "all", options.limit ?? "all"] as const,
  },
  commentStats: {
    summary: (options: CommentStatsOptions = {}) =>
      ["comment-stats", "summary", options.projectId ?? "all"] as const,
  },
  projectStats: {
    summary: (options: ProjectStatsOptions = {}) =>
      ["project-stats", "summary", options.orgId ?? "all"] as const,
  },
  projectFeed: {
    feed: (options: ProjectFeedOptions = {}) =>
      [
        "project-feed",
        "feed",
        options.orgId ?? "all",
        options.lifecycle ?? "all",
        options.limit ?? "all",
      ] as const,
  },
  projectOverview: {
    detail: (projectId: string, options: ProjectOverviewOptions = {}) =>
      ["project-overview", "detail", projectId, options.recentLimit ?? "all"] as const,
  },
  providerOverview: {
    detail: (providerId: string) => ["provider-overview", "detail", providerId] as const,
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
  providerFeed: {
    feed: (options: ProviderFeedOptions = {}) =>
      [
        "provider-feed",
        "feed",
        options.location ?? "all",
        options.status ?? "all",
        options.limit ?? "all",
      ] as const,
  },
  extensionStats: {
    summary: (options: ExtensionStatsOptions = {}) =>
      ["extension-stats", "summary", options.type ?? "all", options.status ?? "all"] as const,
  },
  extensionFeed: {
    feed: (options: ExtensionFeedOptions = {}) =>
      [
        "extension-feed",
        "feed",
        options.type ?? "all",
        options.status ?? "all",
        options.limit ?? "all",
      ] as const,
  },
  extensionOverview: {
    detail: (extensionId: string) => ["extension-overview", "detail", extensionId] as const,
  },
  organizationFeed: {
    feed: (options: OrganizationFeedOptions = {}) =>
      ["organization-feed", "feed", options.limit ?? "all"] as const,
  },
  organizationStats: {
    summary: (options: OrganizationStatsOptions = {}) =>
      ["organization-stats", "summary", options.orgId ?? "all"] as const,
  },
  organizationOverview: {
    detail: (orgId: string, options: OrganizationOverviewOptions = {}) =>
      ["organization-overview", "detail", orgId, options.recentLimit ?? "all"] as const,
  },
  pipelineStats: {
    summary: (options: PipelineStatsOptions = {}) =>
      ["pipeline-stats", "summary", options.projectId ?? "all"] as const,
  },
  pipelineFeed: {
    feed: (options: PipelineFeedOptions = {}) =>
      [
        "pipeline-feed",
        "feed",
        options.projectId ?? "all",
        options.kind ?? "all",
        options.limit ?? "all",
      ] as const,
  },
  lineageStats: {
    summary: (options: LineageStatsOptions = {}) =>
      ["lineage-stats", "summary", options.projectId ?? "all"] as const,
  },
  lineageFeed: {
    feed: (options: LineageFeedOptions = {}) =>
      ["lineage-feed", "feed", options.projectId ?? "all", options.limit ?? "all"] as const,
  },
  collaborationStats: {
    summary: (options: CollaborationStatsOptions = {}) =>
      ["collaboration-stats", "summary", options.projectId ?? "all"] as const,
  },
  collaborationFeed: {
    feed: (options: CollaborationFeedOptions = {}) =>
      [
        "collaboration-feed",
        "feed",
        options.projectId ?? "all",
        options.signal ?? "all",
        options.limit ?? "all",
      ] as const,
  },
  orchestrationStats: {
    summary: (options: OrchestrationStatsOptions = {}) =>
      ["orchestration-stats", "summary", options.projectId ?? "all"] as const,
  },
  orchestrationFeed: {
    feed: (options: OrchestrationFeedOptions = {}) =>
      [
        "orchestration-feed",
        "feed",
        options.projectId ?? "all",
        options.kind ?? "all",
        options.limit ?? "all",
      ] as const,
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
  operationFeed: {
    feed: (options: OperationFeedOptions = {}) =>
      [
        "operation-feed",
        "feed",
        options.streaming ?? "all",
        options.provider_id ?? "all",
        options.limit ?? "all",
      ] as const,
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
  eventFeed: {
    feed: (options: EventFeedOptions = {}) =>
      [
        "event-feed",
        "feed",
        options.projectId ?? "all",
        options.type ?? "all",
        options.limit ?? "all",
      ] as const,
  },
  retryStats: {
    summary: (options: RetryStatsOptions = {}) =>
      ["retry-stats", "summary", options.projectId ?? "all"] as const,
  },
  retryFeed: {
    feed: (options: RetryFeedOptions = {}) =>
      ["retry-feed", "feed", options.projectId ?? "all", options.limit ?? "all"] as const,
  },
  versionStats: {
    summary: (options: VersionStatsOptions = {}) =>
      ["version-stats", "summary", options.projectId ?? "all"] as const,
  },
  versionFeed: {
    feed: (options: VersionFeedOptions = {}) =>
      ["version-feed", "feed", options.projectId ?? "all", options.limit ?? "all"] as const,
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
