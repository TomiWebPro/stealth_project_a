import type { ApiClient } from "./apiClient";
import { mockApiClient } from "./apiClient";
import { env } from "./env";
import { createHttpApiClient } from "./httpApiClient";

/**
 * Resolves the active API client based on `VITE_API_MODE`.
 * Consumers receive it through `ApiProvider`, not by importing it directly.
 */
export function resolveApiClient(): ApiClient {
  if (env.apiMode === "live") {
    return createHttpApiClient(env.apiBaseUrl);
  }
  return mockApiClient;
}
