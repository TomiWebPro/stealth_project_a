import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "../../api/client";
import { ASSETS, CONVERSATIONS, EXTENSIONS, JOBS, PROJECTS, PROVIDERS } from "./data";
import {
  clearMockFailures,
  fetchAsset,
  fetchAssetImpact,
  fetchAssets,
  fetchAssetsByProject,
  fetchCapabilities,
  fetchComments,
  fetchConversation,
  fetchConversations,
  fetchCurrentUser,
  fetchExtension,
  fetchExtensions,
  fetchHomeSummary,
  fetchJob,
  fetchJobs,
  fetchJobStats,
  fetchOperations,
  fetchOrchestrationRun,
  fetchOrganizations,
  fetchPresence,
  fetchProject,
  fetchProjectDetail,
  fetchProjects,
  fetchProvider,
  fetchProviders,
  fetchRecentAssets,
  fetchStorageStats,
  fetchTags,
  fetchWorkflowTemplates,
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
    await expect(fetchJobStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchProviders()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchConversations(projectId)).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrchestrationRun("missing")).rejects.toBeInstanceOf(ApiError);
    // Newly guarded domains must honour the wildcard too.
    await expect(fetchCapabilities()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchExtensions()).rejects.toBeInstanceOf(ApiError);
  });

  it("can be switched off per domain without clearing the rest", async () => {
    setMockFailure("assets");
    setMockFailure("jobs");
    setMockFailure("assets", false);

    await expect(fetchAssets()).resolves.toBeDefined();
    await expect(fetchJobs()).rejects.toMatchObject({ code: "mock_failure" });
  });

  it("exposes an injectable failure for the job stats domain", async () => {
    setMockFailure("jobStats");

    await expect(fetchJobStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchJobStats()).resolves.toBeDefined();
  });

  it("exposes injectable failures for the tags and impact domains", async () => {
    const assetId = "0b5c1e2a-2000-4000-8000-000000000011";
    setMockFailure("tags");
    setMockFailure("impact");

    await expect(fetchTags()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
    await expect(fetchAssetImpact(assetId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchTags()).resolves.toBeDefined();
    await expect(fetchAssetImpact(assetId)).resolves.toBeDefined();
  });

  it(
    "exposes injectable failures for every remaining query domain",
    async () => {
      const projectId = PROJECTS[0]?.id ?? "";
      const assetId = ASSETS[0]?.id ?? "";
      const jobId = JOBS[0]?.id ?? "";
      const providerId = PROVIDERS[0]?.id ?? "";
      const conversationId = CONVERSATIONS[0]?.id ?? "";
      const extensionId = EXTENSIONS[0]?.manifest.id ?? "";

      const guarded: Array<[string, () => Promise<unknown>]> = [
        ["projects", () => fetchProject(projectId)],
        ["projects", () => fetchProjectDetail(projectId)],
        ["assets", () => fetchAsset(assetId)],
        ["assets", () => fetchRecentAssets()],
        ["assets", () => fetchAssetsByProject(projectId)],
        ["assets", () => fetchWorkflowTemplates()],
        ["jobs", () => fetchJob(jobId)],
        ["providers", () => fetchProvider(providerId)],
        ["operations", () => fetchOperations()],
        ["capabilities", () => fetchCapabilities()],
        ["conversations", () => fetchConversation(conversationId)],
        ["auth", () => fetchCurrentUser()],
        ["auth", () => fetchOrganizations()],
        ["presence", () => fetchPresence(projectId)],
        ["comments", () => fetchComments(projectId)],
        ["storage", () => fetchStorageStats(projectId)],
        ["extensions", () => fetchExtensions()],
        ["extensions", () => fetchExtension(extensionId)],
      ];

      for (const [domain, run] of guarded) {
        setMockFailure(domain);
        await expect(run(), `${domain} query should fail`).rejects.toMatchObject({
          name: "ApiError",
          status: 503,
          code: "mock_failure",
        });
        clearMockFailures();
        await expect(run(), `${domain} query should recover`).resolves.not.toBeInstanceOf(ApiError);
      }
    },
    20_000,
  );
});
