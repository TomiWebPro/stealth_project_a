import type { UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../app/apiContext";
import type { CapabilityMatch } from "../lib/catalog";
import type { HomeSummary } from "../lib/homeSummary";
import type { ProjectDetail } from "../lib/projectDetail";
import type {
  Asset,
  Comment,
  Conversation,
  Extension,
  Job,
  Message,
  OperationCatalog,
  Organization,
  OrchestrationRun,
  Presence,
  Project,
  Provider,
  StorageStats,
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
