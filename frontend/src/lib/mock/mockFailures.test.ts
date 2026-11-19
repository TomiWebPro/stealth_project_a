import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "../../api/client";
import { ASSETS, CONVERSATIONS, EXTENSIONS, JOBS, PROJECTS, PROVIDERS } from "./data";
import {
  clearMockFailures,
  fetchActivityStats,
  fetchAsset,
  fetchAssetFeed,
  fetchAssetImpact,
  fetchAssetStats,
  fetchAssets,
  fetchAssetsByProject,
  fetchCapabilities,
  fetchCollaborationStats,
  fetchCommentFeed,
  fetchCommentStats,
  fetchComments,
  fetchConversation,
  fetchConversations,
  fetchConversationStats,
  fetchConversationFeed,
  fetchCurrentUser,
  fetchEventFeed,
  fetchEventStats,
  fetchExtension,
  fetchExtensions,
  fetchExtensionStats,
  fetchHomeSummary,
  fetchJob,
  fetchJobFeed,
  fetchJobLogs,
  fetchJobQueue,
  fetchJobs,
  fetchJobStats,
  fetchLineageFeed,
  fetchLineageStats,
  fetchOperations,
  fetchOperationStats,
  fetchOrganizationFeed,
  fetchOrganizationStats,
  fetchPipelineStats,
  fetchOrchestrationRun,
  fetchOrchestrationStats,
  fetchOrganizations,
  fetchPresence,
  fetchProject,
  fetchProjectDetail,
  fetchProjectFeed,
  fetchProjectStats,
  fetchProjects,
  fetchProvider,
  fetchProviders,
  fetchProviderStats,
  fetchPublishFeed,
  fetchPublishStats,
  fetchRecentAssets,
  fetchRetryStats,
  fetchSearchStats,
  fetchStorageStats,
  fetchTags,
  fetchUploadFeed,
  fetchUploadStats,
  fetchVersionFeed,
  fetchVersionStats,
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
    await expect(fetchActivityStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchSearchStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchUploadStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchUploadFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchEventStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchRetryStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchVersionStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchVersionFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchPublishStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchPublishFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchConversationFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchCommentFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchCommentStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchJobs()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchJobFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchJobLogs(JOBS[0]?.id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchJobQueue()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchJobStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchAssetStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchAssetFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchConversationStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchProjectStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchProjectFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchProviderStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchExtensionStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOperationStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrganizationStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrganizationFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchPipelineStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchLineageStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchLineageFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchCollaborationStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrchestrationStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchProviders()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchConversations(projectId)).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrchestrationRun("missing")).rejects.toBeInstanceOf(ApiError);
    // Newly guarded domains must honour the wildcard too.
    await expect(fetchCapabilities()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchExtensions()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchEventFeed()).rejects.toBeInstanceOf(ApiError);
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

  it("exposes an injectable failure for the job queue domain", async () => {
    setMockFailure("jobQueue");

    await expect(fetchJobQueue()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchJobQueue()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the job log domain", async () => {
    const jobId = JOBS[0]?.id ?? "";
    setMockFailure("jobLogs");

    await expect(fetchJobLogs(jobId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchJobLogs(jobId)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the asset stats domain", async () => {
    setMockFailure("assetStats");

    await expect(fetchAssetStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchAssetStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the conversation stats domain", async () => {
    setMockFailure("conversationStats");

    await expect(fetchConversationStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchConversationStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the project stats domain", async () => {
    setMockFailure("projectStats");

    await expect(fetchProjectStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchProjectStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the provider stats domain", async () => {
    setMockFailure("providerStats");

    await expect(fetchProviderStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchProviderStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the extension stats domain", async () => {
    setMockFailure("extensionStats");

    await expect(fetchExtensionStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchExtensionStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the operation stats domain", async () => {
    setMockFailure("operationStats");

    await expect(fetchOperationStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchOperationStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the organization feed domain", async () => {
    setMockFailure("organizationFeed");

    await expect(fetchOrganizationFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchOrganizationFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the organization stats domain", async () => {
    setMockFailure("organizationStats");

    await expect(fetchOrganizationStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchOrganizationStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the pipeline stats domain", async () => {
    setMockFailure("pipelineStats");

    await expect(fetchPipelineStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchPipelineStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the lineage stats domain", async () => {
    setMockFailure("lineageStats");

    await expect(fetchLineageStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchLineageStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the collaboration stats domain", async () => {
    setMockFailure("collaborationStats");

    await expect(fetchCollaborationStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchCollaborationStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the activity stats domain", async () => {
    setMockFailure("activityStats");

    await expect(fetchActivityStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchActivityStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the search stats domain", async () => {
    setMockFailure("searchStats");

    await expect(fetchSearchStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchSearchStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the upload stats domain", async () => {
    setMockFailure("uploadStats");

    await expect(fetchUploadStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchUploadStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the upload feed domain", async () => {
    setMockFailure("uploadFeed");

    await expect(fetchUploadFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchUploadFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the asset feed domain", async () => {
    setMockFailure("assetFeed");

    await expect(fetchAssetFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchAssetFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the job feed domain", async () => {
    setMockFailure("jobFeed");

    await expect(fetchJobFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchJobFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the project feed domain", async () => {
    setMockFailure("projectFeed");

    await expect(fetchProjectFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchProjectFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the conversation feed domain", async () => {
    setMockFailure("conversationFeed");

    await expect(fetchConversationFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchConversationFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the comment feed domain", async () => {
    setMockFailure("commentFeed");

    await expect(fetchCommentFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchCommentFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the comment stats domain", async () => {
    setMockFailure("commentStats");

    await expect(fetchCommentStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchCommentStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the event stats domain", async () => {
    setMockFailure("eventStats");

    await expect(fetchEventStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchEventStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the retry stats domain", async () => {
    setMockFailure("retryStats");

    await expect(fetchRetryStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchRetryStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the version stats domain", async () => {
    setMockFailure("versionStats");

    await expect(fetchVersionStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchVersionStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the version feed domain", async () => {
    setMockFailure("versionFeed");

    await expect(fetchVersionFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchVersionFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the lineage feed domain", async () => {
    setMockFailure("lineageFeed");

    await expect(fetchLineageFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchLineageFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the event feed domain", async () => {
    setMockFailure("eventFeed");

    await expect(fetchEventFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchEventFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the publish stats domain", async () => {
    setMockFailure("publishStats");

    await expect(fetchPublishStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchPublishStats()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the publish feed domain", async () => {
    setMockFailure("publishFeed");

    await expect(fetchPublishFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchPublishFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the orchestration stats domain", async () => {
    setMockFailure("orchestrationStats");

    await expect(fetchOrchestrationStats()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchOrchestrationStats()).resolves.toBeDefined();
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
        ["providerStats", () => fetchProviderStats()],
        ["extensionStats", () => fetchExtensionStats()],
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
