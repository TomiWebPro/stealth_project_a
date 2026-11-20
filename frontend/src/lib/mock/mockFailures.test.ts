import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "../../api/client";
import { extensionId as computeExtensionId } from "../extensionFeed";
import {
  ASSETS,
  CONVERSATIONS,
  EXTENSIONS,
  JOBS,
  JOB_EVENTS,
  MESSAGES,
  ORGANIZATIONS,
  ORCHESTRATION_PLANS,
  ORCHESTRATION_RUNS,
  PIPELINE_CHAINS,
  PROJECTS,
  PROVIDERS,
  USERS,
} from "./data";
import {
  clearMockFailures,
  fetchActivityStats,
  fetchAsset,
  fetchAssetFeed,
  fetchAssetImpact,
  fetchAssetOverview,
  fetchAssetStats,
  fetchAssets,
  fetchAssetsByProject,
  fetchCapabilities,
  fetchChainOverview,
  fetchCollaborationFeed,
  fetchCollaborationStats,
  fetchCommentFeed,
  fetchCommentStats,
  fetchCommentOverview,
  fetchComments,
  fetchConversation,
  fetchConversations,
  fetchConversationStats,
  fetchConversationFeed,
  fetchConversationOverview,
  fetchMessageOverview,
  fetchCurrentUser,
  fetchEventFeed,
  fetchEventOverview,
  fetchEventStats,
  fetchExtension,
  fetchExtensionFeed,
  fetchExtensionOverview,
  fetchExtensions,
  fetchExtensionStats,
  fetchHomeSummary,
  fetchJob,
  fetchJobFeed,
  fetchJobLogs,
  fetchJobOverview,
  fetchJobQueue,
  fetchJobs,
  fetchJobStats,
  fetchLineageFeed,
  fetchLineageOverview,
  fetchLineageStats,
  fetchOperations,
  fetchOperationFeed,
  fetchOperationOverview,
  fetchOperationStats,
  fetchOrganizationFeed,
  fetchOrganizationOverview,
  fetchOrganizationStats,
  fetchPipelineFeed,
  fetchPipelineStats,
  fetchProjectOverview,
  fetchOrchestrationFeed,
  fetchOrchestrationRun,
  fetchOrchestrationStats,
  fetchPlanOverview,
  fetchRunOverview,
  fetchOrganizations,
  fetchPresence,
  fetchProject,
  fetchProjectDetail,
  fetchProjectFeed,
  fetchProjectStats,
  fetchProjects,
  fetchProvider,
  fetchProviders,
  fetchProviderFeed,
  fetchProviderOverview,
  fetchProviderStats,
  fetchPublishFeed,
  fetchPublishOverview,
  fetchPublishStats,
  fetchRecentAssets,
  fetchRetryFeed,
  fetchRetryStats,
  fetchSearchStats,
  fetchStorageStats,
  fetchTags,
  fetchTagOverview,
  fetchUploadFeed,
  fetchUploadOverview,
  fetchUploadStats,
  fetchMembershipOverview,
  fetchUserOverview,
  fetchVersionFeed,
  fetchVersionOverview,
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
    await expect(fetchUploadOverview("0b5c1e2a-7000-4000-8000-000000000001")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchEventStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchRetryStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchRetryFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchVersionStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchVersionFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchPublishStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchPublishFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchPublishOverview(ASSETS[0]?.id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchTagOverview("lora")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchConversationFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchCommentFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchCommentStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchCommentOverview("0b5c1e2a-6200-4000-8000-000000000001")).rejects.toBeInstanceOf(ApiError);
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
    await expect(fetchOperationFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrganizationStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrganizationFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrganizationOverview(ORGANIZATIONS[0]?.id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchPipelineStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchPipelineFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchChainOverview(PIPELINE_CHAINS[0]?.id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchProjectOverview(projectId)).rejects.toBeInstanceOf(ApiError);
    await expect(fetchAssetOverview(ASSETS[0]?.id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchConversationOverview(CONVERSATIONS[0]?.id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchJobOverview(JOBS[0]?.id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchProviderOverview(PROVIDERS[0]?.id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(
      fetchExtensionOverview(computeExtensionId(EXTENSIONS[0]?.manifest.id ?? "")),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(fetchLineageStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchLineageFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchCollaborationStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchCollaborationFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrchestrationStats()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrchestrationFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchPlanOverview(ORCHESTRATION_PLANS[0]?.plan_id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchRunOverview(ORCHESTRATION_RUNS[0]?.run_id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchProviders()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchConversations(projectId)).rejects.toBeInstanceOf(ApiError);
    await expect(fetchOrchestrationRun("missing")).rejects.toBeInstanceOf(ApiError);
    // Newly guarded domains must honour the wildcard too.
    await expect(fetchCapabilities()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchExtensions()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchEventFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchExtensionFeed()).rejects.toBeInstanceOf(ApiError);
    await expect(fetchMembershipOverview(ORGANIZATIONS[0]?.id ?? "", USERS[0]?.id ?? "")).rejects.toBeInstanceOf(ApiError);
    await expect(fetchEventOverview(JOB_EVENTS[0]?.job_id ?? "", JOB_EVENTS[0]?.seq ?? 0)).rejects.toBeInstanceOf(ApiError);
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

  it("exposes an injectable failure for the job overview domain", async () => {
    const jobId = JOBS[0]?.id ?? "";
    setMockFailure("jobOverview");

    await expect(fetchJobOverview(jobId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchJobOverview(jobId)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the provider overview domain", async () => {
    const providerId = PROVIDERS[0]?.id ?? "";
    setMockFailure("providerOverview");

    await expect(fetchProviderOverview(providerId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchProviderOverview(providerId)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the extension overview domain", async () => {
    const id = computeExtensionId(EXTENSIONS[0]?.manifest.id ?? "");
    setMockFailure("extensionOverview");

    await expect(fetchExtensionOverview(id)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchExtensionOverview(id)).resolves.toBeDefined();
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

  it("exposes an injectable failure for the provider feed domain", async () => {
    setMockFailure("providerFeed");

    await expect(fetchProviderFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchProviderFeed()).resolves.toBeDefined();
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

  it("exposes an injectable failure for the extension feed domain", async () => {
    setMockFailure("extensionFeed");

    await expect(fetchExtensionFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchExtensionFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the operation feed domain", async () => {
    setMockFailure("operationFeed");

    await expect(fetchOperationFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchOperationFeed()).resolves.toBeDefined();
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

  it("exposes an injectable failure for the operation overview domain", async () => {
    const operationId = "text-to-image";
    setMockFailure("operationOverview");

    await expect(fetchOperationOverview(operationId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchOperationOverview(operationId)).resolves.toBeDefined();
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

  it("exposes an injectable failure for the organization overview domain", async () => {
    const orgId = ORGANIZATIONS[0]?.id ?? "";
    setMockFailure("organizationOverview");

    await expect(fetchOrganizationOverview(orgId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchOrganizationOverview(orgId)).resolves.toBeDefined();
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

  it("exposes an injectable failure for the pipeline feed domain", async () => {
    setMockFailure("pipelineFeed");

    await expect(fetchPipelineFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchPipelineFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the chain overview domain", async () => {
    const chainId = PIPELINE_CHAINS[0]?.id ?? "";
    setMockFailure("chainOverview");

    await expect(fetchChainOverview(chainId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchChainOverview(chainId)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the plan overview domain", async () => {
    const planId = ORCHESTRATION_PLANS[0]?.plan_id ?? "";
    setMockFailure("planOverview");

    await expect(fetchPlanOverview(planId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchPlanOverview(planId)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the run overview domain", async () => {
    const runId = ORCHESTRATION_RUNS[0]?.run_id ?? "";
    setMockFailure("runOverview");

    await expect(fetchRunOverview(runId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchRunOverview(runId)).resolves.toBeDefined();
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

  it("exposes an injectable failure for the collaboration feed domain", async () => {
    setMockFailure("collaborationFeed");

    await expect(fetchCollaborationFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchCollaborationFeed()).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the asset overview domain", async () => {
    const overviewAssetId = ASSETS[0]?.id ?? "";
    setMockFailure("assetOverview");

    await expect(fetchAssetOverview(overviewAssetId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchAssetOverview(overviewAssetId)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the conversation overview domain", async () => {
    const overviewConversationId = CONVERSATIONS[0]?.id ?? "";
    setMockFailure("conversationOverview");

    await expect(fetchConversationOverview(overviewConversationId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchConversationOverview(overviewConversationId)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the message overview domain", async () => {
    const overviewConversationId = CONVERSATIONS[0]?.id ?? "";
    const overviewMessageId = MESSAGES.find((m) => m.conversation_id === overviewConversationId)?.id ?? "";
    setMockFailure("messageOverview");

    await expect(fetchMessageOverview(overviewConversationId, overviewMessageId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchMessageOverview(overviewConversationId, overviewMessageId)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the event overview domain", async () => {
    const overviewJobId = JOB_EVENTS[0]?.job_id ?? "";
    const overviewSeq = JOB_EVENTS[0]?.seq ?? 0;
    setMockFailure("eventOverview");

    await expect(fetchEventOverview(overviewJobId, overviewSeq)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchEventOverview(overviewJobId, overviewSeq)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the project overview domain", async () => {
    const overviewProjectId = PROJECTS[0]?.id ?? "";
    setMockFailure("projectOverview");

    await expect(fetchProjectOverview(overviewProjectId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchProjectOverview(overviewProjectId)).resolves.toBeDefined();
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

  it("exposes an injectable failure for the upload overview domain", async () => {
    const uploadId = "0b5c1e2a-7000-4000-8000-000000000001";
    setMockFailure("uploadOverview");

    await expect(fetchUploadOverview(uploadId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchUploadOverview(uploadId)).resolves.toBeDefined();
  });

  it("exposes an injectable failure for the version overview domain", async () => {
    const assetId = ASSETS[0]?.id ?? "";
    setMockFailure("versionOverview");

    await expect(fetchVersionOverview(assetId, ASSETS[0]?.version ?? 1)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchVersionOverview(assetId, ASSETS[0]?.version ?? 1)).resolves.toBeDefined();
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

  it("exposes an injectable failure for the comment overview domain", async () => {
    const commentId = "0b5c1e2a-6200-4000-8000-000000000001";
    setMockFailure("commentOverview");

    await expect(fetchCommentOverview(commentId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchCommentOverview(commentId)).resolves.toBeDefined();
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

  it("exposes an injectable failure for the retry feed domain", async () => {
    setMockFailure("retryFeed");

    await expect(fetchRetryFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchRetryFeed()).resolves.toBeDefined();
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

  it("exposes an injectable failure for the publish overview domain", async () => {
    const assetId = ASSETS.find((asset) => asset.metadata?.["publish_receipt"] !== undefined)?.id ?? "";
    setMockFailure("publishOverview");

    await expect(fetchPublishOverview(assetId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchPublishOverview(assetId)).resolves.toBeDefined();
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

  it("exposes an injectable failure for the orchestration feed domain", async () => {
    setMockFailure("orchestrationFeed");

    await expect(fetchOrchestrationFeed()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchOrchestrationFeed()).resolves.toBeDefined();
  });

  it("exposes injectable failures for the tags, tag-overview and impact domains", async () => {
    const assetId = "0b5c1e2a-2000-4000-8000-000000000011";
    setMockFailure("tags");
    setMockFailure("tagOverview");
    setMockFailure("impact");

    await expect(fetchTags()).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
    await expect(fetchTagOverview("lora")).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });
    await expect(fetchAssetImpact(assetId)).rejects.toMatchObject({
      status: 503,
      code: "mock_failure",
    });

    clearMockFailures();
    await expect(fetchTags()).resolves.toBeDefined();
    await expect(fetchTagOverview("lora")).resolves.toBeDefined();
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
        ["providerFeed", () => fetchProviderFeed()],
        ["providerOverview", () => fetchProviderOverview(providerId)],
        ["operationOverview", () => fetchOperationOverview("text-to-image")],
        ["chainOverview", () => fetchChainOverview(PIPELINE_CHAINS[0]?.id ?? "")],
        ["planOverview", () => fetchPlanOverview(ORCHESTRATION_PLANS[0]?.plan_id ?? "")],
        ["runOverview", () => fetchRunOverview(ORCHESTRATION_RUNS[0]?.run_id ?? "")],
        ["uploadOverview", () => fetchUploadOverview("0b5c1e2a-7000-4000-8000-000000000001")],
        ["commentOverview", () => fetchCommentOverview("0b5c1e2a-6200-4000-8000-000000000001")],
        ["messageOverview", () => fetchMessageOverview(CONVERSATIONS[0]?.id ?? "", MESSAGES[0]?.id ?? "")],
        ["eventOverview", () => fetchEventOverview(JOB_EVENTS[0]?.job_id ?? "", JOB_EVENTS[0]?.seq ?? 0)],
        ["lineageOverview", () => fetchLineageOverview("0b5c1e2a-5000-4000-8000-000000000001")],
        ["versionOverview", () => fetchVersionOverview(ASSETS[0]?.id ?? "", ASSETS[0]?.version ?? 1)],
        ["publishOverview", () => fetchPublishOverview(assetId)],
        ["tagOverview", () => fetchTagOverview("lora")],
        ["extensionOverview", () => fetchExtensionOverview(computeExtensionId(EXTENSIONS[0]?.manifest.id ?? ""))],
        ["organizationOverview", () => fetchOrganizationOverview(ORGANIZATIONS[0]?.id ?? "")],
        ["userOverview", () => fetchUserOverview(USERS[0]?.id ?? "")],
        ["membershipOverview", () => fetchMembershipOverview(ORGANIZATIONS[0]?.id ?? "", USERS[0]?.id ?? "")],
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
