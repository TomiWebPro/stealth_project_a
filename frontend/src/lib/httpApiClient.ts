import type { ApiClient } from "./apiClient";
import type { HomeSummary } from "./homeSummary";
import type { ProjectDetail } from "./projectDetail";
import type { Asset, Job, Project, Provider } from "./types";

/**
 * Live HTTP client for the real application API.
 *
 * Phase 1 runs on `mockApiClient`; this is the single place a future
 * integration should touch. It implements the same `ApiClient` contract as the
 * mock, so consumers (hooks, screens) never change when live mode is enabled.
 *
 * The canonical typed transport with auth + error normalization lives in
 * `src/api`. Once backend endpoints are stable, replace these `fetch` calls
 * with `src/api/createApiClient` and keep the `ApiClient` shape.
 */
export function createHttpApiClient(baseUrl: string): ApiClient {
  const root = baseUrl.replace(/\/+$/, "");

  async function getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${root}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Request to ${path} failed (${response.status}).`);
    }
    const payload: unknown = await response.json();
    return payload as T;
  }

  return {
    getHomeSummary: () => getJson<HomeSummary>("/home/summary"),
    listProjects: () => getJson<readonly Project[]>("/projects"),
    getProject: (projectId) => getJson<Project | undefined>(`/projects/${projectId}`),
    listRecentAssets: (limit = 6) =>
      getJson<readonly Asset[]>(`/assets?limit=${limit}`),
    listAssetsByProject: (projectId) =>
      getJson<readonly Asset[]>(`/assets?project_id=${projectId}`),
    listJobs: (projectId) =>
      getJson<readonly Job[]>(projectId ? `/jobs?project_id=${projectId}` : "/jobs"),
    getProjectDetail: (projectId) => getJson<ProjectDetail | undefined>(`/projects/${projectId}/detail`),
    listProviders: () => getJson<readonly Provider[]>("/providers"),
  };
}
