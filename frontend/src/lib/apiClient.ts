import type { HomeSummary } from "./homeSummary";
import type { ProjectDetail } from "./projectDetail";
import type { Asset, Job, Project, Provider } from "./types";
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
  listRecentAssets(limit?: number): Promise<readonly Asset[]>;
  listAssetsByProject(projectId: string): Promise<readonly Asset[]>;
  listJobs(projectId?: string): Promise<readonly Job[]>;
  getProjectDetail(projectId: string): Promise<ProjectDetail | undefined>;
  listProviders(): Promise<readonly Provider[]>;
}

/** In-memory implementation of {@link ApiClient} backed by `lib/mock`. */
export const mockApiClient: ApiClient = {
  getHomeSummary: mockApi.fetchHomeSummary,
  listProjects: mockApi.fetchProjects,
  getProject: mockApi.fetchProject,
  listRecentAssets: mockApi.fetchRecentAssets,
  listAssetsByProject: mockApi.fetchAssetsByProject,
  listJobs: mockApi.fetchJobs,
  getProjectDetail: mockApi.fetchProjectDetail,
  listProviders: mockApi.fetchProviders,
};
