import { createContext, useContext } from "react";
import type { ApiClient } from "../lib/apiClient";

/**
 * React context carrying the active API client.
 *
 * Kept in its own module (no component exports) so the `useApiClient` hook can
 * be imported without breaking React Fast Refresh in `ApiProvider.tsx`.
 */
export const ApiContext = createContext<ApiClient | null>(null);

/** Access the active API client. Must be used within an `<ApiProvider>`. */
export function useApiClient(): ApiClient {
  const client = useContext(ApiContext);
  if (client === null) {
    throw new Error("useApiClient must be used within an <ApiProvider>.");
  }
  return client;
}
