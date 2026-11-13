import type { UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../app/apiContext";
import type { HomeSummary } from "../lib/homeSummary";
import type { Asset, Project, Provider } from "../lib/types";
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

export function useRecentAssets(limit = 6): UseQueryResult<readonly Asset[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.assets.recent(limit),
    queryFn: () => api.listRecentAssets(limit),
  });
}

export function useProviders(): UseQueryResult<readonly Provider[]> {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.providers.all(),
    queryFn: () => api.listProviders(),
  });
}
