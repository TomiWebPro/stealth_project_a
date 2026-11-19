import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useApiClient } from "../app/apiContext";
import type { ActivityOptions } from "../lib/activity";
import type { AuditQuery } from "../lib/audit";
import type { CapabilityMatch } from "../lib/catalog";
import type { ConversationStatsOptions } from "../lib/conversationStats";
import type { DashboardOptions } from "../lib/dashboard";
import type { HomeSummary } from "../lib/homeSummary";
import type { ImpactOptions } from "../lib/impact";
import type { JobStatsOptions } from "../lib/jobStats";
import type { ProjectDetail } from "../lib/projectDetail";
import type { SearchOptions } from "../lib/search";
import type { TagOptions } from "../lib/tags";
import type {
  ActivityFeed,
  Asset,
  AssetImpact,
  AssetUpdate,
  AuditTrail,
  Comment,
  Conversation,
  ConversationStats,
  DashboardSummary,
  Extension,
  Job,
  JobStats,
  Message,
  MessageCreate,
  OperationCatalog,
  Organization,
  OrchestrationRun,
  Presence,
  Project,
  Provider,
  SearchResponse,
  StorageStats,
  StreamEvent,
  TagIndex,
  User,
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
