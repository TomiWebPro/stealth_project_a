import { describe, expect, it } from "vitest";
import type { ApiClient } from "../lib/apiClient";
import { mockApiClient } from "../lib/apiClient";
import { resolveApiClient } from "../lib/createApiClient";
import { createHttpApiClient } from "../lib/httpApiClient";

/**
 * P2.8 smoke test: screens consume the `ApiClient` surface only, so both the
 * mock and live transports must expose exactly the same contract. This guards
 * against a method being added to one transport but not the other (which would
 * break screens only in one mode).
 */
const CONTRACT_METHODS: readonly (keyof ApiClient)[] = [
  "getHomeSummary",
  "listProjects",
  "getProject",
  "listAssets",
  "getAsset",
  "listRecentAssets",
  "listAssetsByProject",
  "listJobs",
  "listJobsByProject",
  "getJob",
  "getProjectDetail",
  "listProviders",
  "getProvider",
  "listWorkflowTemplates",
];

function expectFullContract(client: ApiClient, label: string): void {
  for (const method of CONTRACT_METHODS) {
    expect(typeof client[method], `${label}.${method}`).toBe("function");
  }
}

describe("ApiClient contract parity across modes", () => {
  it("mock transport implements the full screen-facing contract", () => {
    expectFullContract(mockApiClient, "mockApiClient");
  });

  it("live HTTP transport implements the full screen-facing contract", () => {
    expectFullContract(
      createHttpApiClient("http://localhost:8000/api/v1/"),
      "httpApiClient",
    );
  });

  it("resolver returns a contract-complete client in the default (mock) mode", () => {
    expectFullContract(resolveApiClient(), "resolveApiClient()");
  });
});
