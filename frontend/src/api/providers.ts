/** Provider discovery and extension management endpoints. */

import type {
  CapabilityQuery,
  Extension,
  ExtensionInstallRequest,
  ExtensionInstallResult,
  Provider,
  Uuid,
} from "../types";
import type { ApiClient } from "./client";

export function createProvidersApi(client: ApiClient) {
  return {
    list(query: CapabilityQuery = {}): Promise<Provider[]> {
      return client.get("/providers", {
        query: { operation_id: query.operation_id, location: query.location },
      });
    },
    get(providerId: string): Promise<Provider> {
      return client.get(`/providers/${providerId}`);
    },
  };
}

export function createExtensionsApi(client: ApiClient) {
  return {
    list(): Promise<Extension[]> {
      return client.get("/extensions");
    },
    get(extensionId: Uuid): Promise<Extension> {
      return client.get(`/extensions/${extensionId}`);
    },
    install(body: ExtensionInstallRequest): Promise<ExtensionInstallResult> {
      return client.post("/extensions/install", body);
    },
    enable(extensionId: Uuid): Promise<Extension> {
      return client.post(`/extensions/${extensionId}/enable`);
    },
    disable(extensionId: Uuid): Promise<Extension> {
      return client.post(`/extensions/${extensionId}/disable`);
    },
    remove(extensionId: Uuid): Promise<void> {
      return client.delete<void>(`/extensions/${extensionId}`);
    },
  };
}

export type ProvidersApi = ReturnType<typeof createProvidersApi>;
export type ExtensionsApi = ReturnType<typeof createExtensionsApi>;
