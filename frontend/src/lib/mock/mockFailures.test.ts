import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "../../api/client";
import { PROJECTS } from "./data";
import {
  clearMockFailures,
  fetchAssets,
  fetchConversations,
  fetchHomeSummary,
  fetchJobs,
  fetchOrchestrationRun,
  fetchProjects,
  fetchProviders,
  setMockFailure,
} from "./mockApi";

afterEach(() => {
  clearMockFailures();
});

describe("mock error-state fakes", () => {
  it("fails only the switched domain and restores normal responses on reset", async () => {
    setMockFailure("projects");

    await expect(fetchProjects()).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      code: "mock_failure",
    });
    await expect(fetchAssets()).resolves.toBeDefined();

    clearMockFailures();
    expect(await fetchProjects()).toEqual(PROJECTS);
  });

  it("supports the wildcard switch for every guarded query", async () => {
    setMockFailure("*");
    const projectId = PROJECTS[0]?.id ?? "";

    await expect(fetchHomeSummary()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchJobs()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchProviders()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchConversations(projectId)).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrchestrationRun("missing")).rejects.toBeInstanceOf(ApiError);
  });

  it("can be switched off per domain without clearing the rest", async () => {
    setMockFailure("assets");
    setMockFailure("jobs");
    setMockFailure("assets", false);

    await expect(fetchAssets()).resolves.toBeDefined();
    await expect(fetchJobs()).rejects.toMatchObject({ code: "mock_failure" });
  });
});
