import type { UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../app/apiContext";
import type { HomeSummary } from "../lib/homeSummary";
import type { ProjectDetail } from "../lib/projectDetail";
import type { Asset, Job, Project, Provider } from "../lib/types";
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

export function useJobs(projectId?: string): UseQueryResult<readonly Job[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: projectId ? queryKeys.jobs.byProject(projectId) : queryKeys.jobs.all(),
    queryFn: () => api.listJobs(projectId),
  });
}

export function useProviders(): UseQueryResult<readonly Provider[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.providers.all(),
    queryFn: () => api.listProviders(),
  });
}
