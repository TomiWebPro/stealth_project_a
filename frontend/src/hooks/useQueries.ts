import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useApiClient } from "../app/apiContext";
import type { ActivityOptions } from "../lib/activity";
import type { ActivityStatsOptions } from "../lib/activityStats";
import type { AssetFeedOptions } from "../lib/assetFeed";
import type { AssetOverviewOptions } from "../lib/assetOverview";
import type { VersionOverviewOptions } from "../lib/versionOverview";
import type { AssetStatsOptions } from "../lib/assetStats";
import type { AuditQuery } from "../lib/audit";
import type { CapabilityMatch } from "../lib/catalog";
import type { ChainOverviewOptions } from "../lib/chainOverview";
import type { CollaborationFeedOptions } from "../lib/collaborationFeed";
import type { CollaborationStatsOptions } from "../lib/collaborationStats";
import type { CommentStatsOptions } from "../lib/commentStats";
import type { CommentFeedOptions } from "../lib/commentFeed";
import type { ConversationFeedOptions } from "../lib/conversationFeed";
import type { ConversationOverviewOptions } from "../lib/conversationOverview";
import type { ConversationStatsOptions } from "../lib/conversationStats";
import type { DashboardOptions } from "../lib/dashboard";
import type { EventFeedOptions } from "../lib/eventFeed";
import type { EventStatsOptions } from "../lib/eventStats";
import type { ExtensionFeedOptions } from "../lib/extensionFeed";
import type { ExtensionStatsOptions } from "../lib/extensionStats";
import type { HomeSummary } from "../lib/homeSummary";
import type { ImpactOptions } from "../lib/impact";
import type { JobFeedOptions } from "../lib/jobFeed";
import type { JobLogsOptions } from "../lib/jobLogs";
import type { JobOverviewOptions } from "../lib/jobOverview";
import type { JobQueueOptions } from "../lib/jobQueue";
import type { JobStatsOptions } from "../lib/jobStats";
import type { LineageFeedOptions } from "../lib/lineageFeed";
import type { LineageStatsOptions } from "../lib/lineageStats";
import type { OperationFeedOptions } from "../lib/operationFeed";
import type { OrganizationFeedOptions } from "../lib/organizationFeed";
import type { OrganizationOverviewOptions } from "../lib/organizationOverview";
import type { OrganizationStatsOptions } from "../lib/organizationStats";
import type { OrchestrationStatsOptions } from "../lib/orchestrationStats";
import type { OrchestrationFeedOptions } from "../lib/orchestrationFeed";
import type { PipelineFeedOptions } from "../lib/pipelineFeed";
import type { PipelineStatsOptions } from "../lib/pipelineStats";
import type { PlanOverviewOptions } from "../lib/planOverview";
import type { RunOverviewOptions } from "../lib/runOverview";
import type { ProjectDetail } from "../lib/projectDetail";
import type { ProjectFeedOptions } from "../lib/projectFeed";
import type { ProjectOverviewOptions } from "../lib/projectOverview";
import type { ProjectStatsOptions } from "../lib/projectStats";
import type { ProviderFeedOptions } from "../lib/providerFeed";
import type { ProviderStatsOptions } from "../lib/providerStats";
import type { PublishFeedOptions } from "../lib/publishFeed";
import type { PublishStatsOptions } from "../lib/publishStats";
import type { RetryFeedOptions } from "../lib/retryFeed";
import type { RetryStatsOptions } from "../lib/retryStats";
import type { SearchOptions } from "../lib/search";
import type { SearchStatsOptions } from "../lib/searchStats";
import type { TagOptions } from "../lib/tags";
import type { UploadFeedOptions } from "../lib/uploadFeed";
import type { UploadStatsOptions } from "../lib/uploadStats";
import type { VersionFeedOptions } from "../lib/versionFeed";
import type { VersionStatsOptions } from "../lib/versionStats";
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
  ChainOverview,
  CollaborationFeed,
  CollaborationStats,
  Comment,
  CommentFeed,
  CommentStats,
  Conversation,
  ConversationFeed,
  ConversationOverview,
  ConversationStats,
  DashboardSummary,
  EventFeed,
  EventStats,
  Extension,
  ExtensionFeed,
  ExtensionOverview,
  ExtensionStats,
  Job,
  JobFeed,
  JobLogFrame,
  JobOverview,
  JobQueueView,
  JobStats,
  LineageFeed,
  LineageStats,
  Message,
  MessageCreate,
  OperationCatalog,
  OperationFeed,
  OperationOverview,
  OperationStats,
  Organization,
  OrganizationFeed,
  OrganizationOverview,
  OrganizationStats,
  OrchestrationFeed,
  OrchestrationRun,
  OrchestrationStats,
  PipelineFeed,
  PipelineStats,
  PlanOverview,
  RunOverview,
  Presence,
  Project,
  ProjectFeed,
  ProjectOverview,
  ProjectStats,
  Provider,
  ProviderFeed,
  ProviderOverview,
  ProviderStats,
  PublishFeed,
  PublishStats,
  RetryFeed,
  RetryStats,
  SearchResponse,
  SearchStats,
  StorageStats,
  StreamEvent,
  TagIndex,
  UploadFeed,
  UploadOverview,
  UploadStats,
  User,
  VersionFeed,
  VersionOverview,
  VersionStats,
} from "../lib/types";
import { queryKeys } from "../lib/queryKeys";

export function useHomeSummary(): UseQueryResult<HomeSummary> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.home.summary(),
    queryFn: () => api.getHomeSummary(),
  });
}

/** Newest-first authoritative workspace activity feed (C29). */
export function useActivity(options?: ActivityOptions): UseQueryResult<ActivityFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.activity.feed(options),
    queryFn: () => api.getActivity(options),
  });
}

/** Authoritative activity metrics from `/activity/stats`, optionally project-scoped (C89). */
export function useActivityStats(
  options?: ActivityStatsOptions,
): UseQueryResult<ActivityStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.activityStats.summary(options),
    queryFn: () => api.getActivityStats(options),
  });
}

/** Authoritative workspace snapshot from the backend `/dashboard` endpoint (C25). */
export function useDashboard(options?: DashboardOptions): UseQueryResult<DashboardSummary> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.dashboard.summary(options),
    queryFn: () => api.getDashboard(options),
  });
}

/** Authoritative job execution metrics from `/jobs/stats`, optionally project-scoped (C40). */
export function useJobStats(options?: JobStatsOptions): UseQueryResult<JobStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.jobStats.summary(options),
    queryFn: () => api.getJobStats(options),
  });
}

/** Newest-first authoritative job feed from `/jobs/feed`, optionally project/status-scoped (C141). */
export function useJobFeed(options?: JobFeedOptions): UseQueryResult<JobFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.jobFeed.feed(options),
    queryFn: () => api.getJobFeed(options),
  });
}

/** Authoritative asset inventory metrics from `/assets/stats`, optionally project-scoped (C49). */
export function useAssetStats(options?: AssetStatsOptions): UseQueryResult<AssetStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.assetStats.summary(options),
    queryFn: () => api.getAssetStats(options),
  });
}

/** Newest-first authoritative asset feed from `/assets/feed`, optionally project-scoped (C137). */
export function useAssetFeed(options?: AssetFeedOptions): UseQueryResult<AssetFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.assetFeed.feed(options),
    queryFn: () => api.getAssetFeed(options),
  });
}

/** Authoritative conversation/message metrics from `/conversations/stats`, optionally project-scoped (C45). */
export function useConversationStats(
  options?: ConversationStatsOptions,
): UseQueryResult<ConversationStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.conversationStats.summary(options),
    queryFn: () => api.getConversationStats(options),
  });
}

/** Newest-first authoritative conversation feed from `/conversations/feed`, optionally project-scoped (C133). */
export function useConversationFeed(options?: ConversationFeedOptions): UseQueryResult<ConversationFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.conversationFeed.feed(options),
    queryFn: () => api.getConversationFeed(options),
  });
}

/** Newest-first authoritative comment feed from `/comments/feed`, optionally project-scoped (C149). */
export function useCommentFeed(options?: CommentFeedOptions): UseQueryResult<CommentFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.commentFeed.feed(options),
    queryFn: () => api.getCommentFeed(options),
  });
}

/** Authoritative comment metrics from `/comments/stats`, optionally project-scoped (C165). */
export function useCommentStats(options?: CommentStatsOptions): UseQueryResult<CommentStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.commentStats.summary(options),
    queryFn: () => api.getCommentStats(options),
  });
}

/** Authoritative project portfolio metrics from `/projects/stats`, optionally org-scoped (C53). */
export function useProjectStats(options?: ProjectStatsOptions): UseQueryResult<ProjectStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.projectStats.summary(options),
    queryFn: () => api.getProjectStats(options),
  });
}

/** Newest-first authoritative project feed from `/projects/feed`, optionally org/lifecycle-scoped (C145). */
export function useProjectFeed(options?: ProjectFeedOptions): UseQueryResult<ProjectFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.projectFeed.feed(options),
    queryFn: () => api.getProjectFeed(options),
  });
}

/** Authoritative provider fleet metrics from `/providers/stats`, optionally filtered (C57). */
export function useProviderStats(options?: ProviderStatsOptions): UseQueryResult<ProviderStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.providerStats.summary(options),
    queryFn: () => api.getProviderStats(options),
  });
}

/** Deterministic authoritative provider feed from `/providers/feed`, optionally filtered/limited (C185). */
export function useProviderFeed(options?: ProviderFeedOptions): UseQueryResult<ProviderFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.providerFeed.feed(options),
    queryFn: () => api.getProviderFeed(options),
  });
}

/**
 * Authoritative single-provider snapshot (identity, advertised operations and
 * catalog bindings) from `/providers/{id}/overview` (C217).
 */
export function useProviderOverview(providerId: string): UseQueryResult<ProviderOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.providerOverview.detail(providerId),
    queryFn: () => api.getProviderOverview(providerId),
  });
}

/** Authoritative extension registry/installation metrics from `/extensions/stats`, optionally filtered (C61). */
export function useExtensionStats(
  options?: ExtensionStatsOptions,
): UseQueryResult<ExtensionStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.extensionStats.summary(options),
    queryFn: () => api.getExtensionStats(options),
  });
}

/** Newest-first authoritative extension installation feed from `/extensions/feed`, optionally filtered/limited (C173). */
export function useExtensionFeed(
  options?: ExtensionFeedOptions,
): UseQueryResult<ExtensionFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.extensionFeed.feed(options),
    queryFn: () => api.getExtensionFeed(options),
  });
}

/**
 * Authoritative single-extension snapshot (manifest identity, trust and declared
 * scope) from `/extensions/{id}/overview` (C222).
 */
export function useExtensionOverview(
  extensionId: string,
): UseQueryResult<ExtensionOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.extensionOverview.detail(extensionId),
    queryFn: () => api.getExtensionOverview(extensionId),
  });
}

/** Newest-first authoritative organization feed from `/orgs/feed`, with joined activity counts (C161). */
export function useOrganizationFeed(
  options?: OrganizationFeedOptions,
): UseQueryResult<OrganizationFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.organizationFeed.feed(options),
    queryFn: () => api.getOrganizationFeed(options),
  });
}

/** Authoritative organization/membership metrics from `/orgs/stats`, optionally org-scoped (C69). */
export function useOrganizationStats(
  options?: OrganizationStatsOptions,
): UseQueryResult<OrganizationStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.organizationStats.summary(options),
    queryFn: () => api.getOrganizationStats(options),
  });
}

/**
 * Authoritative single-organization snapshot (identity, whole-scope counts,
 * zero-filled role breakdown and recent members/projects) from
 * `/orgs/{id}/overview`, optionally bounding the recent lists (C226).
 */
export function useOrganizationOverview(
  orgId: string,
  options?: OrganizationOverviewOptions,
): UseQueryResult<OrganizationOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.organizationOverview.detail(orgId, options),
    queryFn: () => api.getOrganizationOverview(orgId, options),
  });
}

/** Authoritative production-pipeline metrics from `/pipelines/stats`, optionally project-scoped (C73). */
export function usePipelineStats(
  options?: PipelineStatsOptions,
): UseQueryResult<PipelineStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.pipelineStats.summary(options),
    queryFn: () => api.getPipelineStats(options),
  });
}

/** Newest-first authoritative production-pipeline feed from `/pipelines/feed`, optionally project/kind-scoped (C177). */
export function usePipelineFeed(
  options?: PipelineFeedOptions,
): UseQueryResult<PipelineFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.pipelineFeed.feed(options),
    queryFn: () => api.getPipelineFeed(options),
  });
}

/**
 * Authoritative single-chain snapshot (identity, counts and bounded recent
 * linked jobs/assets) from `/pipelines/{id}/overview` (C234).
 */
export function useChainOverview(
  chainId: string,
  options?: ChainOverviewOptions,
): UseQueryResult<ChainOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.chainOverview.detail(chainId, options),
    queryFn: () => api.getChainOverview(chainId, options),
  });
}

/** Authoritative asset-lineage metrics from `/lineage/stats`, optionally project-scoped (C77). */
export function useLineageStats(
  options?: LineageStatsOptions,
): UseQueryResult<LineageStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.lineageStats.summary(options),
    queryFn: () => api.getLineageStats(options),
  });
}

/** Newest-first authoritative asset lineage feed from `/lineage/feed`, optionally project-scoped (C157). */
export function useLineageFeed(
  options?: LineageFeedOptions,
): UseQueryResult<LineageFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.lineageFeed.feed(options),
    queryFn: () => api.getLineageFeed(options),
  });
}

/** Authoritative collaboration metrics from `/collaboration/stats`, optionally project-scoped (C81). */
export function useCollaborationStats(
  options?: CollaborationStatsOptions,
): UseQueryResult<CollaborationStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.collaborationStats.summary(options),
    queryFn: () => api.getCollaborationStats(options),
  });
}

/** Newest-first authoritative collaboration feed from `/collaboration/feed`, optionally project/signal-scoped (C197). */
export function useCollaborationFeed(
  options?: CollaborationFeedOptions,
): UseQueryResult<CollaborationFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.collaborationFeed.feed(options),
    queryFn: () => api.getCollaborationFeed(options),
  });
}

/** Authoritative orchestration metrics from `/orchestration/stats`, optionally project-scoped (C85). */
export function useOrchestrationStats(
  options?: OrchestrationStatsOptions,
): UseQueryResult<OrchestrationStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.orchestrationStats.summary(options),
    queryFn: () => api.getOrchestrationStats(options),
  });
}

/** Newest-first authoritative orchestration feed from `/orchestration/feed`, optionally project/kind-scoped (C181). */
export function useOrchestrationFeed(
  options?: OrchestrationFeedOptions,
): UseQueryResult<OrchestrationFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.orchestrationFeed.feed(options),
    queryFn: () => api.getOrchestrationFeed(options),
  });
}

/**
 * Authoritative single-plan snapshot (identity, whole-scope counts and bounded
 * recent runs) from `/orchestration/plans/{id}/overview` (C238).
 */
export function usePlanOverview(
  planId: string,
  options?: PlanOverviewOptions,
): UseQueryResult<PlanOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.planOverview.detail(planId, options),
    queryFn: () => api.getPlanOverview(planId, options),
  });
}

/**
 * Authoritative single-run snapshot (identity, joined context and bounded recent
 * linked jobs) from `/orchestration/runs/{id}/overview` (C242).
 */
export function useRunOverview(
  runId: string,
  options?: RunOverviewOptions,
): UseQueryResult<RunOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.runOverview.detail(runId, options),
    queryFn: () => api.getRunOverview(runId, options),
  });
}

export function useProjects(): UseQueryResult<readonly Project[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: () => api.listProjects(),
  });
}

export function useProject(projectId: string): UseQueryResult<Project | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.projects.byId(projectId),
    queryFn: () => api.getProject(projectId),
  });
}

export function useProjectDetail(projectId: string): UseQueryResult<ProjectDetail | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => api.getProjectDetail(projectId),
  });
}

/**
 * Authoritative single-asset snapshot (identity, published flag, counts and a
 * bounded newest-version list) from `/assets/{id}/overview` (C205).
 */
export function useAssetOverview(
  assetId: string,
  options?: AssetOverviewOptions,
): UseQueryResult<AssetOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.assetOverview.detail(assetId, options),
    queryFn: () => api.getAssetOverview(assetId, options),
  });
}

/**
 * Authoritative single asset-version snapshot (identity + storage, joined
 * project context, `is_latest` and whole-asset version counts with a bounded
 * sibling list) from `/assets/{id}/versions/{version}/overview` (C250).
 */
export function useVersionOverview(
  assetId: string,
  version: number,
  options?: VersionOverviewOptions,
): UseQueryResult<VersionOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.versionOverview.detail(assetId, version, options),
    queryFn: () => api.getVersionOverview(assetId, version, options),
  });
}

/**
 * Authoritative single-conversation snapshot (identity, zero-filled message
 * counts, last-message preview and a bounded newest-message list) from
 * `/conversations/{id}/overview` (C209).
 */
export function useConversationOverview(
  conversationId: string,
  options?: ConversationOverviewOptions,
): UseQueryResult<ConversationOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.conversationOverview.detail(conversationId, options),
    queryFn: () => api.getConversationOverview(conversationId, options),
  });
}

/**
 * Authoritative single-job snapshot (identity, event/retry counts and a bounded
 * newest-event list) from `/jobs/{id}/overview` (C213).
 */
export function useJobOverview(
  jobId: string,
  options?: JobOverviewOptions,
): UseQueryResult<JobOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.jobOverview.detail(jobId, options),
    queryFn: () => api.getJobOverview(jobId, options),
  });
}

/**
 * Authoritative single-project snapshot (counts + recent jobs/assets) from
 * `/projects/{id}/overview`, optionally bounding the recent lists (C201).
 */
export function useProjectOverview(
  projectId: string,
  options?: ProjectOverviewOptions,
): UseQueryResult<ProjectOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.projectOverview.detail(projectId, options),
    queryFn: () => api.getProjectOverview(projectId, options),
  });
}

/** Newest-first authoritative audit feed (C20) for one project. */
export function useProjectAudit(
  projectId: string,
  query?: AuditQuery,
): UseQueryResult<AuditTrail | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.audit.trail(projectId, query),
    queryFn: () => api.getProjectAudit(projectId, query),
  });
}

export function useAssets(): UseQueryResult<readonly Asset[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.assets.all(),
    queryFn: () => api.listAssets(),
  });
}

export function useAsset(assetId: string): UseQueryResult<Asset | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.assets.byId(assetId),
    queryFn: () => api.getAsset(assetId),
  });
}

export interface UpdateAssetVariables {
  readonly assetId: string;
  readonly body: AssetUpdate;
}

/**
 * Persist an asset metadata patch through the active transport, then refresh
 * every derived asset view (list, detail, recent, project detail, home summary).
 */
export function useUpdateAsset(): UseMutationResult<Asset, Error, UpdateAssetVariables> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, body }: UpdateAssetVariables) => api.updateAsset(assetId, body),
    onSuccess: () => {
      for (const queryKey of queryKeys.assetWriteRoots()) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useRecentAssets(limit = 6): UseQueryResult<readonly Asset[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.assets.recent(limit),
    queryFn: () => api.listRecentAssets(limit),
  });
}

export function useAssetsByProject(projectId: string): UseQueryResult<readonly Asset[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.assets.byProject(projectId),
    queryFn: () => api.listAssetsByProject(projectId),
  });
}

export function useJobs(
  projectId?: string,
  status?: Job["status"],
): UseQueryResult<readonly Job[]> {
  const api = useApiClient();
  const params = projectId || status ? { projectId, status } : undefined;
  return useQuery({
    queryKey: params ? queryKeys.jobs.list(params) : queryKeys.jobs.all(),
    queryFn: () => api.listJobs(projectId, status),
  });
}

export function useJobsByProject(projectId: string): UseQueryResult<readonly Job[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.jobs.byProject(projectId),
    queryFn: () => api.listJobsByProject(projectId),
  });
}

export function useJob(jobId: string): UseQueryResult<Job | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.jobs.byId(jobId),
    queryFn: () => api.getJob(jobId),
  });
}

/** Chronological, level-filtered, paginated console log for one job (C117). */
export function useJobLogs(
  jobId: string,
  options?: JobLogsOptions,
): UseQueryResult<JobLogFrame | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.jobLogs.frame(jobId, options),
    queryFn: () => api.getJobLogs(jobId, options),
    enabled: Boolean(jobId),
  });
}

/** Authoritative active dispatch queue from `/jobs/queue`, optionally project-scoped (C121). */
export function useJobQueue(options?: JobQueueOptions): UseQueryResult<JobQueueView> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.jobQueue.view(options),
    queryFn: () => api.getJobQueue(options),
  });
}

export function useProviders(): UseQueryResult<readonly Provider[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.providers.all(),
    queryFn: () => api.listProviders(),
  });
}

export function useProvider(providerId: string): UseQueryResult<Provider | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.providers.byId(providerId),
    queryFn: () => api.getProvider(providerId),
  });
}


export function useWorkflowTemplates(projectId?: string): UseQueryResult<readonly Asset[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.assets.workflowTemplates(projectId),
    queryFn: () => api.listWorkflowTemplates(projectId),
  });
}

export function useOperations(): UseQueryResult<OperationCatalog> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.operations.catalog(),
    queryFn: () => api.getOperations(),
  });
}

/** Deterministic authoritative operation feed from `/operations/feed`, optionally filtered/limited (C189). */
export function useOperationFeed(options?: OperationFeedOptions): UseQueryResult<OperationFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.operationFeed.feed(options),
    queryFn: () => api.getOperationFeed(options),
  });
}

/** Authoritative operation catalog metrics from `/operations/stats` (C65). */
export function useOperationStats(): UseQueryResult<OperationStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.operationStats.summary(),
    queryFn: () => api.getOperationStats(),
  });
}

/** Authoritative single-operation snapshot from `/operations/{id}/overview` (C230). */
export function useOperationOverview(
  operationId: string,
): UseQueryResult<OperationOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.operationOverview.detail(operationId),
    queryFn: () => api.getOperationOverview(operationId),
  });
}

export function useCapabilities(operationId?: string): UseQueryResult<readonly CapabilityMatch[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.capabilities.list(operationId),
    queryFn: () => api.listCapabilities(operationId),
  });
}

export function useConversations(projectId: string): UseQueryResult<readonly Conversation[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.conversations.byProject(projectId),
    queryFn: () => api.listConversations(projectId),
  });
}

export function useConversation(conversationId: string): UseQueryResult<Conversation | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.conversations.byId(conversationId),
    queryFn: () => api.getConversation(conversationId),
  });
}

export function useMessages(
  conversationId: string,
  limit?: number,
): UseQueryResult<readonly Message[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.messages.byConversation(conversationId, limit),
    queryFn: () => api.listMessages(conversationId, limit),
  });
}

export interface SendMessageVariables {
  readonly conversationId: string;
  readonly body: MessageCreate;
}

/** Send a message through the active transport and refresh the message cache. */
export function useSendMessage(): UseMutationResult<Message, Error, SendMessageVariables> {
  const api = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, body }: SendMessageVariables) =>
      api.sendMessage(conversationId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.all() });
    },
  });
}

/**
 * Subscribe to a conversation's event stream for the lifetime of the component.
 * Pass a `useCallback`-stable `onEvent` (and `conversationId = null` to disable).
 */
export function useConversationStream(
  conversationId: string | null,
  onEvent: (event: StreamEvent) => void,
  resumeFrom?: number,
): void {
  const api = useApiClient();
  useEffect(() => {
    if (!conversationId) return;
    const stream = api.openConversationStream(conversationId, resumeFrom);
    const unsubscribe = stream.onEvent(onEvent);
    return () => {
      unsubscribe();
      stream.close();
    };
  }, [api, conversationId, resumeFrom, onEvent]);
}

export function useCurrentUser(): UseQueryResult<User> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => api.getCurrentUser(),
  });
}

export function useOrganizations(): UseQueryResult<readonly Organization[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.auth.organizations(),
    queryFn: () => api.listOrganizations(),
  });
}

export function useOrchestrationRun(runId: string): UseQueryResult<OrchestrationRun | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.orchestration.run(runId),
    queryFn: () => api.getOrchestrationRun(runId),
  });
}

export function usePresence(projectId: string): UseQueryResult<readonly Presence[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.collaboration.presence(projectId),
    queryFn: () => api.listPresence(projectId),
  });
}

export function useComments(
  projectId: string,
  assetId?: string,
): UseQueryResult<readonly Comment[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.collaboration.comments(projectId, assetId),
    queryFn: () => api.listComments(projectId, assetId),
  });
}

export function useStorageStats(projectId: string): UseQueryResult<StorageStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.storage.stats(projectId),
    queryFn: () => api.getStorageStats(projectId),
  });
}

export function useExtensions(): UseQueryResult<readonly Extension[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.extensions.all(),
    queryFn: () => api.listExtensions(),
  });
}

export function useExtension(extensionId: string): UseQueryResult<Extension | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.extensions.byId(extensionId),
    queryFn: () => api.getExtension(extensionId),
  });
}

/** Ranked cross-domain matches; disabled until the query has non-space text. */
export function useSearch(
  query: string,
  options?: SearchOptions,
): UseQueryResult<SearchResponse> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.search.results(query, options),
    queryFn: () => api.search(query, options),
    enabled: query.trim().length > 0,
  });
}

/** Authoritative search-index metrics from `/search/stats`, optionally project-scoped (C93). */
export function useSearchStats(
  options?: SearchStatsOptions,
): UseQueryResult<SearchStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.searchStats.summary(options),
    queryFn: () => api.getSearchStats(options),
  });
}

/** Authoritative upload-ticket metrics from `/uploads/stats`, optionally project-scoped (C97). */
export function useUploadStats(
  options?: UploadStatsOptions,
): UseQueryResult<UploadStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.uploadStats.summary(options),
    queryFn: () => api.getUploadStats(options),
  });
}

/** Newest-first authoritative upload feed from `/uploads/feed`, optionally project-scoped (C129). */
export function useUploadFeed(options?: UploadFeedOptions): UseQueryResult<UploadFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.uploadFeed.feed(options),
    queryFn: () => api.getUploadFeed(options),
  });
}

/**
 * Authoritative single-upload-ticket snapshot (identity, byte accounting and
 * whole-project counts) from `/uploads/{id}/overview` (C246).
 */
export function useUploadOverview(uploadId: string): UseQueryResult<UploadOverview | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.uploadOverview.detail(uploadId),
    queryFn: () => api.getUploadOverview(uploadId),
  });
}

/** Authoritative job event stream metrics from `/events/stats`, optionally project-scoped (C101). */
export function useEventStats(
  options?: EventStatsOptions,
): UseQueryResult<EventStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.eventStats.summary(options),
    queryFn: () => api.getEventStats(options),
  });
}

/** Newest-first authoritative job event feed from `/events/feed`, optionally project/type-scoped (C169). */
export function useEventFeed(
  options?: EventFeedOptions,
): UseQueryResult<EventFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.eventFeed.feed(options),
    queryFn: () => api.getEventFeed(options),
  });
}

/** Authoritative job retry metrics from `/retries/stats`, optionally project-scoped (C105). */
export function useRetryStats(
  options?: RetryStatsOptions,
): UseQueryResult<RetryStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.retryStats.summary(options),
    queryFn: () => api.getRetryStats(options),
  });
}

/** Newest-first authoritative job retry feed from `/retries/feed`, optionally project-scoped (C193). */
export function useRetryFeed(
  options?: RetryFeedOptions,
): UseQueryResult<RetryFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.retryFeed.feed(options),
    queryFn: () => api.getRetryFeed(options),
  });
}

/** Authoritative asset version metrics from `/versions/stats`, optionally project-scoped (C109). */
export function useVersionStats(
  options?: VersionStatsOptions,
): UseQueryResult<VersionStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.versionStats.summary(options),
    queryFn: () => api.getVersionStats(options),
  });
}

/** Newest-first authoritative asset version feed from `/versions/feed`, optionally project-scoped (C153). */
export function useVersionFeed(
  options?: VersionFeedOptions,
): UseQueryResult<VersionFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.versionFeed.feed(options),
    queryFn: () => api.getVersionFeed(options),
  });
}

/** Authoritative publish-receipt metrics from `/publishes/stats`, optionally project-scoped (C113). */
export function usePublishStats(
  options?: PublishStatsOptions,
): UseQueryResult<PublishStats> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.publishStats.summary(options),
    queryFn: () => api.getPublishStats(options),
  });
}

/** Newest-first authoritative publish feed from `/publishes`, optionally project-scoped (C125). */
export function usePublishFeed(options?: PublishFeedOptions): UseQueryResult<PublishFeed> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.publishFeed.feed(options),
    queryFn: () => api.getPublishFeed(options),
  });
}

/** Most-used-first asset tag facets, optionally scoped/filtered (C33). */
export function useTags(options?: TagOptions): UseQueryResult<TagIndex> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.tags.index(options),
    queryFn: () => api.getTags(options),
  });
}

/** Transitive downstream impact of an asset; unknown roots resolve to undefined (C34). */
export function useAssetImpact(
  assetId: string,
  options?: ImpactOptions,
): UseQueryResult<AssetImpact | undefined> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.impact.asset(assetId, options),
    queryFn: () => api.getAssetImpact(assetId, options),
  });
}
