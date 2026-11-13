import type { HomeSummary } from "./homeSummary";
import type { Asset, Project, Provider } from "./types";
import * as mockApi from "./mock/mockApi";

/**
 * Mock API client facade.
 *
 * Screens and query hooks depend on this interface only. A live HTTP client
 * implementing the same shape (against `src/api`) can be dropped in without
 * touching consumers. Payload types come from the shared contracts in
 * `src/types`; `HomeSummary` is the assembled view model.
 */
export interface ApiClient {
  getHomeSummary(): Promise<HomeSummary>;
  listProjects(): Promise<readonly Project[]>;
  listRecentAssets(limit?: number): Promise<readonly Asset[]>;
  listProviders(): Promise<readonly Provider[]>;
}

/** In-memory implementation of {@link ApiClient} backed by `lib/mock`. */
export const mockApiClient: ApiClient = {
  getHomeSummary: mockApi.fetchHomeSummary,
  listProjects: mockApi.fetchProjects,
  listRecentAssets: mockApi.fetchRecentAssets,
  listProviders: mockApi.fetchProviders,
};
