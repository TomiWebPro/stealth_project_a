/**
 * Studio Platform API client.
 *
 * Usage:
 *   const api = createApiClient({ baseUrl: "http://127.0.0.1:8000" });
 *   const { operations } = await api.operations.catalog();
 *
 * All request/response types come from `src/types`, which mirrors
 * `backend/app/schemas`. Nothing here reaches past the application API.
 */

import { ApiClient, ApiError } from "./client";
import type { ApiClientConfig } from "./client";
import { createAuthApi, createOrgsApi, createProjectsApi } from "./auth";
import { createConversationsApi } from "./conversations";
import { createAssetsApi } from "./assets";
import { createHealthApi } from "./health";
import { createOperationsApi } from "./operations";
import { createExtensionsApi, createProvidersApi } from "./providers";
import {
  createCollaborationApi,
  createOrchestrationApi,
  createStorageApi,
} from "./orchestration";

export interface StudioApi {
  client: ApiClient;
  auth: ReturnType<typeof createAuthApi>;
  orgs: ReturnType<typeof createOrgsApi>;
  projects: ReturnType<typeof createProjectsApi>;
  conversations: ReturnType<typeof createConversationsApi>;
  assets: ReturnType<typeof createAssetsApi>;
  health: ReturnType<typeof createHealthApi>;
  operations: ReturnType<typeof createOperationsApi>;
  providers: ReturnType<typeof createProvidersApi>;
  extensions: ReturnType<typeof createExtensionsApi>;
  orchestration: ReturnType<typeof createOrchestrationApi>;
  collaboration: ReturnType<typeof createCollaborationApi>;
  storage: ReturnType<typeof createStorageApi>;
}

export function createApiClient(config: ApiClientConfig = {}): StudioApi {
  const client = new ApiClient(config);
  return {
    client,
    auth: createAuthApi(client),
    orgs: createOrgsApi(client),
    projects: createProjectsApi(client),
    conversations: createConversationsApi(client),
    assets: createAssetsApi(client),
    health: createHealthApi(client),
    operations: createOperationsApi(client),
    providers: createProvidersApi(client),
    extensions: createExtensionsApi(client),
    orchestration: createOrchestrationApi(client),
    collaboration: createCollaborationApi(client),
    storage: createStorageApi(client),
  };
}

export { ApiClient, ApiError };
export type { ApiClientConfig, RequestOptions, FetchLike } from "./client";

export default createApiClient;
export type { AssetListQuery } from "./assets";
export * from "./auth";
export * from "./assets";
export * from "./conversations";
export * from "./health";
export * from "./operations";
export * from "./providers";
export * from "./orchestration";
