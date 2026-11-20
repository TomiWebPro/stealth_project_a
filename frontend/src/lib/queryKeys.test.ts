import { describe, expect, it } from "vitest";

import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  it("builds stable home keys", () => {
    expect(queryKeys.home.summary()).toEqual(["home", "summary"]);
  });

  it("scopes the workspace activity key by project, kind and limit", () => {
    expect(queryKeys.activity.feed()).toEqual([
      "activity",
      "feed",
      "all",
      "all",
      "all",
    ]);
    expect(queryKeys.activity.feed({ projectId: "p1", kind: "job", limit: 10 })).toEqual([
      "activity",
      "feed",
      "p1",
      "job",
      10,
    ]);
  });

  it("scopes the dashboard snapshot key by recent_limit", () => {
    expect(queryKeys.dashboard.summary()).toEqual(["dashboard", "summary", "all"]);
    expect(queryKeys.dashboard.summary({ recentLimit: 10 })).toEqual([
      "dashboard",
      "summary",
      10,
    ]);
  });

  it("scopes the job stats key by project", () => {
    expect(queryKeys.jobStats.summary()).toEqual(["job-stats", "summary", "all"]);
    expect(queryKeys.jobStats.summary({ projectId: "p1" })).toEqual([
      "job-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the job log key by job, severity, cursor and page size", () => {
    expect(queryKeys.jobLogs.frame("j1")).toEqual([
      "job-logs",
      "frame",
      "j1",
      "all",
      0,
      50,
    ]);
    expect(queryKeys.jobLogs.frame("j1", { level: "error", sinceSeq: 3, limit: 10 })).toEqual([
      "job-logs",
      "frame",
      "j1",
      "error",
      3,
      10,
    ]);
  });

  it("scopes the job queue key by project and page size", () => {
    expect(queryKeys.jobQueue.view()).toEqual(["job-queue", "view", "all", "all"]);
    expect(queryKeys.jobQueue.view({ projectId: "p1", limit: 10 })).toEqual([
      "job-queue",
      "view",
      "p1",
      10,
    ]);
  });

  it("scopes the asset stats key by project", () => {
    expect(queryKeys.assetStats.summary()).toEqual(["asset-stats", "summary", "all"]);
    expect(queryKeys.assetStats.summary({ projectId: "p1" })).toEqual([
      "asset-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the conversation stats key by project", () => {
    expect(queryKeys.conversationStats.summary()).toEqual([
      "conversation-stats",
      "summary",
      "all",
    ]);
    expect(queryKeys.conversationStats.summary({ projectId: "p1" })).toEqual([
      "conversation-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the asset feed key by project and limit", () => {
    expect(queryKeys.assetFeed.feed()).toEqual(["asset-feed", "feed", "all", "all"]);
    expect(queryKeys.assetFeed.feed({ projectId: "p1", limit: 5 })).toEqual([
      "asset-feed",
      "feed",
      "p1",
      5,
    ]);
  });

  it("scopes the job feed key by project, status and limit", () => {
    expect(queryKeys.jobFeed.feed()).toEqual(["job-feed", "feed", "all", "all", "all"]);
    expect(queryKeys.jobFeed.feed({ projectId: "p1", status: "failed", limit: 5 })).toEqual([
      "job-feed",
      "feed",
      "p1",
      "failed",
      5,
    ]);
  });

  it("scopes the conversation feed key by project and limit", () => {
    expect(queryKeys.conversationFeed.feed()).toEqual(["conversation-feed", "feed", "all", "all"]);
    expect(queryKeys.conversationFeed.feed({ projectId: "p1", limit: 5 })).toEqual([
      "conversation-feed",
      "feed",
      "p1",
      5,
    ]);
  });

  it("scopes the comment stats key by project", () => {
    expect(queryKeys.commentStats.summary()).toEqual(["comment-stats", "summary", "all"]);
    expect(queryKeys.commentStats.summary({ projectId: "p1" })).toEqual([
      "comment-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the comment overview key by comment id and recent limit", () => {
    expect(queryKeys.commentOverview.detail("c1")).toEqual([
      "comment-overview",
      "detail",
      "c1",
      "all",
    ]);
    expect(queryKeys.commentOverview.detail("c1", { recentLimit: 3 })).toEqual([
      "comment-overview",
      "detail",
      "c1",
      3,
    ]);
  });

  it("scopes the lineage overview key by relationship id and recent limit", () => {
    expect(queryKeys.lineageOverview.detail("r1")).toEqual([
      "lineage-overview",
      "detail",
      "r1",
      "all",
    ]);
    expect(queryKeys.lineageOverview.detail("r1", { recentLimit: 3 })).toEqual([
      "lineage-overview",
      "detail",
      "r1",
      3,
    ]);
  });

  it("scopes the project stats key by organization", () => {
    expect(queryKeys.projectStats.summary()).toEqual(["project-stats", "summary", "all"]);
    expect(queryKeys.projectStats.summary({ orgId: "o1" })).toEqual([
      "project-stats",
      "summary",
      "o1",
    ]);
  });

  it("scopes the project feed key by organization, lifecycle and limit", () => {
    expect(queryKeys.projectFeed.feed()).toEqual(["project-feed", "feed", "all", "all", "all"]);
    expect(queryKeys.projectFeed.feed({ orgId: "o1", lifecycle: "archived", limit: 5 })).toEqual([
      "project-feed",
      "feed",
      "o1",
      "archived",
      5,
    ]);
  });

  it("scopes the asset overview key by asset and recent limit", () => {
    expect(queryKeys.assetOverview.detail("a1")).toEqual([
      "asset-overview",
      "detail",
      "a1",
      "all",
    ]);
    expect(queryKeys.assetOverview.detail("a1", { recentLimit: 3 })).toEqual([
      "asset-overview",
      "detail",
      "a1",
      3,
    ]);
  });

  it("scopes the version overview key by asset, version and recent limit", () => {
    expect(queryKeys.versionOverview.detail("a1", 2)).toEqual([
      "version-overview",
      "detail",
      "a1",
      2,
      "all",
    ]);
    expect(queryKeys.versionOverview.detail("a1", 2, { recentLimit: 3 })).toEqual([
      "version-overview",
      "detail",
      "a1",
      2,
      3,
    ]);
  });

  it("scopes the conversation overview key by conversation and recent limit", () => {
    expect(queryKeys.conversationOverview.detail("c1")).toEqual([
      "conversation-overview",
      "detail",
      "c1",
      "all",
    ]);
    expect(queryKeys.conversationOverview.detail("c1", { recentLimit: 3 })).toEqual([
      "conversation-overview",
      "detail",
      "c1",
      3,
    ]);
  });

  it("scopes the job overview key by job and recent limit", () => {
    expect(queryKeys.jobOverview.detail("j1")).toEqual([
      "job-overview",
      "detail",
      "j1",
      "all",
    ]);
    expect(queryKeys.jobOverview.detail("j1", { recentLimit: 3 })).toEqual([
      "job-overview",
      "detail",
      "j1",
      3,
    ]);
  });

  it("scopes the provider overview key by provider", () => {
    expect(queryKeys.providerOverview.detail("prov_local")).toEqual([
      "provider-overview",
      "detail",
      "prov_local",
    ]);
  });

  it("scopes the extension overview key by extension", () => {
    expect(queryKeys.extensionOverview.detail("ext-1")).toEqual([
      "extension-overview",
      "detail",
      "ext-1",
    ]);
  });

  it("scopes the organization overview key by organization and recent limit", () => {
    expect(queryKeys.organizationOverview.detail("org-1")).toEqual([
      "organization-overview",
      "detail",
      "org-1",
      "all",
    ]);
    expect(queryKeys.organizationOverview.detail("org-1", { recentLimit: 3 })).toEqual([
      "organization-overview",
      "detail",
      "org-1",
      3,
    ]);
  });

  it("scopes the user overview key by user and recent limit", () => {
    expect(queryKeys.userOverview.detail("user-1")).toEqual([
      "user-overview",
      "detail",
      "user-1",
      "all",
    ]);
    expect(queryKeys.userOverview.detail("user-1", { recentLimit: 3 })).toEqual([
      "user-overview",
      "detail",
      "user-1",
      3,
    ]);
  });

  it("scopes the membership overview key by org, user and recent limit", () => {
    expect(queryKeys.membershipOverview.detail("org-1", "user-1")).toEqual([
      "membership-overview",
      "detail",
      "org-1",
      "user-1",
      "all",
    ]);
    expect(queryKeys.membershipOverview.detail("org-1", "user-1", { recentLimit: 3 })).toEqual([
      "membership-overview",
      "detail",
      "org-1",
      "user-1",
      3,
    ]);
  });

  it("scopes the project overview key by project and recent limit", () => {
    expect(queryKeys.projectOverview.detail("p1")).toEqual([
      "project-overview",
      "detail",
      "p1",
      "all",
    ]);
    expect(queryKeys.projectOverview.detail("p1", { recentLimit: 3 })).toEqual([
      "project-overview",
      "detail",
      "p1",
      3,
    ]);
  });

  it("scopes the organization stats key by organization", () => {
    expect(queryKeys.organizationStats.summary()).toEqual(["organization-stats", "summary", "all"]);
    expect(queryKeys.organizationStats.summary({ orgId: "o1" })).toEqual([
      "organization-stats",
      "summary",
      "o1",
    ]);
  });

  it("scopes the pipeline stats key by project", () => {
    expect(queryKeys.pipelineStats.summary()).toEqual(["pipeline-stats", "summary", "all"]);
    expect(queryKeys.pipelineStats.summary({ projectId: "p1" })).toEqual([
      "pipeline-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the pipeline feed key by project, kind and limit", () => {
    expect(queryKeys.pipelineFeed.feed()).toEqual([
      "pipeline-feed",
      "feed",
      "all",
      "all",
      "all",
    ]);
    expect(queryKeys.pipelineFeed.feed({ projectId: "p1", kind: "shot", limit: 5 })).toEqual([
      "pipeline-feed",
      "feed",
      "p1",
      "shot",
      5,
    ]);
  });

  it("scopes the chain overview key by chain id and recent limit", () => {
    expect(queryKeys.chainOverview.detail("chain-1")).toEqual([
      "chain-overview",
      "detail",
      "chain-1",
      "all",
    ]);
    expect(queryKeys.chainOverview.detail("chain-1", { recentLimit: 2 })).toEqual([
      "chain-overview",
      "detail",
      "chain-1",
      2,
    ]);
  });

  it("scopes the plan overview key by plan id and recent limit", () => {
    expect(queryKeys.planOverview.detail("plan-1")).toEqual([
      "plan-overview",
      "detail",
      "plan-1",
      "all",
    ]);
    expect(queryKeys.planOverview.detail("plan-1", { recentLimit: 3 })).toEqual([
      "plan-overview",
      "detail",
      "plan-1",
      3,
    ]);
  });

  it("scopes the run overview key by run id and recent limit", () => {
    expect(queryKeys.runOverview.detail("run-1")).toEqual([
      "run-overview",
      "detail",
      "run-1",
      "all",
    ]);
    expect(queryKeys.runOverview.detail("run-1", { recentLimit: 3 })).toEqual([
      "run-overview",
      "detail",
      "run-1",
      3,
    ]);
  });

  it("scopes the lineage stats key by project", () => {
    expect(queryKeys.lineageStats.summary()).toEqual(["lineage-stats", "summary", "all"]);
    expect(queryKeys.lineageStats.summary({ projectId: "p1" })).toEqual([
      "lineage-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the collaboration feed key by project, signal and limit", () => {
    expect(queryKeys.collaborationFeed.feed()).toEqual([
      "collaboration-feed",
      "feed",
      "all",
      "all",
      "all",
    ]);
    expect(
      queryKeys.collaborationFeed.feed({ projectId: "p1", signal: "comment", limit: 5 }),
    ).toEqual(["collaboration-feed", "feed", "p1", "comment", 5]);
  });

  it("scopes the collaboration stats key by project", () => {
    expect(queryKeys.collaborationStats.summary()).toEqual([
      "collaboration-stats",
      "summary",
      "all",
    ]);
    expect(queryKeys.collaborationStats.summary({ projectId: "p1" })).toEqual([
      "collaboration-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the activity stats key by project", () => {
    expect(queryKeys.activityStats.summary()).toEqual([
      "activity-stats",
      "summary",
      "all",
    ]);
    expect(queryKeys.activityStats.summary({ projectId: "p1" })).toEqual([
      "activity-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the orchestration stats key by project", () => {
    expect(queryKeys.orchestrationStats.summary()).toEqual([
      "orchestration-stats",
      "summary",
      "all",
    ]);
    expect(queryKeys.orchestrationStats.summary({ projectId: "p1" })).toEqual([
      "orchestration-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the orchestration feed key by project, kind and limit", () => {
    expect(queryKeys.orchestrationFeed.feed()).toEqual([
      "orchestration-feed",
      "feed",
      "all",
      "all",
      "all",
    ]);
    expect(queryKeys.orchestrationFeed.feed({ projectId: "p1", kind: "run", limit: 5 })).toEqual([
      "orchestration-feed",
      "feed",
      "p1",
      "run",
      5,
    ]);
  });

  it("scopes the provider stats key by location and status", () => {
    expect(queryKeys.providerStats.summary()).toEqual([
      "provider-stats",
      "summary",
      "all",
      "all",
    ]);
    expect(queryKeys.providerStats.summary({ location: "cloud" })).toEqual([
      "provider-stats",
      "summary",
      "cloud",
      "all",
    ]);
    expect(queryKeys.providerStats.summary({ location: "cloud", status: "degraded" })).toEqual([
      "provider-stats",
      "summary",
      "cloud",
      "degraded",
    ]);
  });

  it("scopes the provider feed key by location, status and limit", () => {
    expect(queryKeys.providerFeed.feed()).toEqual([
      "provider-feed",
      "feed",
      "all",
      "all",
      "all",
    ]);
    expect(queryKeys.providerFeed.feed({ location: "cloud", status: "degraded", limit: 5 })).toEqual([
      "provider-feed",
      "feed",
      "cloud",
      "degraded",
      5,
    ]);
  });

  it("scopes the extension stats key by type and status", () => {
    expect(queryKeys.extensionStats.summary()).toEqual([
      "extension-stats",
      "summary",
      "all",
      "all",
    ]);
    expect(queryKeys.extensionStats.summary({ type: "ui" })).toEqual([
      "extension-stats",
      "summary",
      "ui",
      "all",
    ]);
    expect(queryKeys.extensionStats.summary({ type: "ui", status: "enabled" })).toEqual([
      "extension-stats",
      "summary",
      "ui",
      "enabled",
    ]);
  });

  it("scopes the extension feed key by type, status and limit", () => {
    expect(queryKeys.extensionFeed.feed()).toEqual(["extension-feed", "feed", "all", "all", "all"]);
    expect(queryKeys.extensionFeed.feed({ type: "ui", status: "enabled", limit: 5 })).toEqual([
      "extension-feed",
      "feed",
      "ui",
      "enabled",
      5,
    ]);
  });

  it("scopes the search stats key by project", () => {
    expect(queryKeys.searchStats.summary()).toEqual(["search-stats", "summary", "all"]);
    expect(queryKeys.searchStats.summary({ projectId: "p1" })).toEqual([
      "search-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the upload stats key by project", () => {
    expect(queryKeys.uploadStats.summary()).toEqual(["upload-stats", "summary", "all"]);
    expect(queryKeys.uploadStats.summary({ projectId: "p1" })).toEqual([
      "upload-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the upload overview key by upload id", () => {
    expect(queryKeys.uploadOverview.detail("u1")).toEqual(["upload-overview", "detail", "u1"]);
  });

  it("scopes the event stats key by project", () => {
    expect(queryKeys.eventStats.summary()).toEqual(["event-stats", "summary", "all"]);
    expect(queryKeys.eventStats.summary({ projectId: "p1" })).toEqual([
      "event-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the event feed key by project, type and limit", () => {
    expect(queryKeys.eventFeed.feed()).toEqual(["event-feed", "feed", "all", "all", "all"]);
    expect(queryKeys.eventFeed.feed({ projectId: "p1", type: "error", limit: 5 })).toEqual([
      "event-feed",
      "feed",
      "p1",
      "error",
      5,
    ]);
  });

  it("scopes the retry stats key by project", () => {
    expect(queryKeys.retryStats.summary()).toEqual(["retry-stats", "summary", "all"]);
    expect(queryKeys.retryStats.summary({ projectId: "p1" })).toEqual([
      "retry-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the retry feed key by project and limit", () => {
    expect(queryKeys.retryFeed.feed()).toEqual(["retry-feed", "feed", "all", "all"]);
    expect(queryKeys.retryFeed.feed({ projectId: "p1", limit: 5 })).toEqual([
      "retry-feed",
      "feed",
      "p1",
      5,
    ]);
  });

  it("scopes the version stats key by project", () => {
    expect(queryKeys.versionStats.summary()).toEqual(["version-stats", "summary", "all"]);
    expect(queryKeys.versionStats.summary({ projectId: "p1" })).toEqual([
      "version-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the publish stats key by project", () => {
    expect(queryKeys.publishStats.summary()).toEqual(["publish-stats", "summary", "all"]);
    expect(queryKeys.publishStats.summary({ projectId: "p1" })).toEqual([
      "publish-stats",
      "summary",
      "p1",
    ]);
  });

  it("scopes the publish feed key by project and limit", () => {
    expect(queryKeys.publishFeed.feed()).toEqual(["publish-feed", "feed", "all", "all"]);
    expect(queryKeys.publishFeed.feed({ projectId: "p1", limit: 5 })).toEqual([
      "publish-feed",
      "feed",
      "p1",
      5,
    ]);
  });

  it("scopes the upload feed key by project and limit", () => {
    expect(queryKeys.uploadFeed.feed()).toEqual(["upload-feed", "feed", "all", "all"]);
    expect(queryKeys.uploadFeed.feed({ projectId: "p1", limit: 5 })).toEqual([
      "upload-feed",
      "feed",
      "p1",
      5,
    ]);
  });

  it("scopes project keys by id", () => {
    expect(queryKeys.projects.all()).toEqual(["projects"]);
    expect(queryKeys.projects.byId("p1")).toEqual(["projects", "by-id", "p1"]);
    expect(queryKeys.projects.detail("p1")).toEqual(["projects", "detail", "p1"]);
  });

  it("scopes asset keys by limit, id, project, and workflow templates", () => {
    expect(queryKeys.assets.all()).toEqual(["assets"]);
    expect(queryKeys.assets.byId("a1")).toEqual(["assets", "by-id", "a1"]);
    expect(queryKeys.assets.recent(10)).toEqual(["assets", "recent", 10]);
    expect(queryKeys.assets.byProject("p1")).toEqual(["assets", "by-project", "p1"]);
    expect(queryKeys.assets.workflowTemplates()).toEqual([
      "assets",
      "workflow-templates",
      "all",
    ]);
    expect(queryKeys.assets.workflowTemplates("p1")).toEqual([
      "assets",
      "workflow-templates",
      "p1",
    ]);
  });

  it("exposes the cache roots invalidated after an asset write", () => {
    expect(queryKeys.assetWriteRoots()).toEqual([["assets"], ["home"], ["projects"]]);
  });

  it("scopes job list and detail keys", () => {
    expect(queryKeys.jobs.all()).toEqual(["jobs"]);
    expect(queryKeys.jobs.byId("j1")).toEqual(["jobs", "by-id", "j1"]);
    expect(queryKeys.jobs.byProject("p1")).toEqual(["jobs", "by-project", "p1"]);
    expect(queryKeys.jobs.list({ projectId: "p1", status: "failed" })).toEqual([
      "jobs",
      "list",
      { projectId: "p1", status: "failed" },
    ]);
  });

  it("scopes provider keys", () => {
    expect(queryKeys.providers.all()).toEqual(["providers"]);
    expect(queryKeys.providers.byId("prov_local")).toEqual([
      "providers",
      "by-id",
      "prov_local",
    ]);
  });

  it("scopes the new catalog, conversation and message keys", () => {
    expect(queryKeys.operations.catalog()).toEqual(["operations", "catalog"]);
    expect(queryKeys.operationStats.summary()).toEqual(["operation-stats", "summary"]);
    expect(queryKeys.operationOverview.detail("text-to-image")).toEqual([
      "operation-overview",
      "detail",
      "text-to-image",
    ]);
    expect(queryKeys.operationFeed.feed()).toEqual([
      "operation-feed",
      "feed",
      "all",
      "all",
      "all",
    ]);
    expect(
      queryKeys.operationFeed.feed({ streaming: true, provider_id: "prov-a", limit: 5 }),
    ).toEqual(["operation-feed", "feed", true, "prov-a", 5]);
    expect(queryKeys.capabilities.list()).toEqual(["capabilities", "list", "all"]);
    expect(queryKeys.capabilities.list("lora-train")).toEqual([
      "capabilities",
      "list",
      "lora-train",
    ]);
    expect(queryKeys.conversations.byProject("p1")).toEqual([
      "conversations",
      "by-project",
      "p1",
    ]);
    expect(queryKeys.conversations.byId("c1")).toEqual(["conversations", "by-id", "c1"]);
    expect(queryKeys.messages.all()).toEqual(["messages"]);
    expect(queryKeys.messages.byConversation("c1")).toEqual([
      "messages",
      "by-conversation",
      "c1",
      "all",
    ]);
    expect(queryKeys.messages.byConversation("c1", 10)).toEqual([
      "messages",
      "by-conversation",
      "c1",
      10,
    ]);
  });

  it("scopes auth, orchestration, collaboration, storage and extension keys", () => {
    expect(queryKeys.auth.me()).toEqual(["auth", "me"]);
    expect(queryKeys.auth.organizations()).toEqual(["auth", "organizations"]);
    expect(queryKeys.orchestration.run("r1")).toEqual(["orchestration", "run", "r1"]);
    expect(queryKeys.collaboration.presence("p1")).toEqual([
      "collaboration",
      "presence",
      "p1",
    ]);
    expect(queryKeys.collaboration.comments("p1")).toEqual([
      "collaboration",
      "comments",
      "p1",
      "all",
    ]);
    expect(queryKeys.collaboration.comments("p1", "a1")).toEqual([
      "collaboration",
      "comments",
      "p1",
      "a1",
    ]);
    expect(queryKeys.storage.stats("p1")).toEqual(["storage", "stats", "p1"]);
    expect(queryKeys.extensions.all()).toEqual(["extensions"]);
    expect(queryKeys.extensions.byId("e1")).toEqual(["extensions", "by-id", "e1"]);
  });

  it("scopes the audit trail key by project and every filter", () => {
    expect(queryKeys.audit.trail("p1")).toEqual([
      "audit",
      "trail",
      "p1",
      "all",
      "all",
      "all",
      "all",
    ]);
    expect(queryKeys.audit.trail("p1", { kind: "job", limit: 10 })).toEqual([
      "audit",
      "trail",
      "p1",
      "job",
      "all",
      "all",
      10,
    ]);
  });

  it("scopes the cross-domain search key by query and filters", () => {
    expect(queryKeys.search.results("mara")).toEqual([
      "search",
      "results",
      "mara",
      "all",
      "all",
    ]);
    expect(queryKeys.search.results("mara", { kind: "asset", limit: 5 })).toEqual([
      "search",
      "results",
      "mara",
      "asset",
      5,
    ]);
  });

  it("scopes the tag index key by project, prefix and limit", () => {
    expect(queryKeys.tags.index()).toEqual(["tags", "index", "all", "all", "all"]);
    expect(queryKeys.tags.index({ projectId: "p1", prefix: "lora", limit: 5 })).toEqual([
      "tags",
      "index",
      "p1",
      "lora",
      5,
    ]);
  });

  it("scopes the asset impact key by id and max depth", () => {
    expect(queryKeys.impact.asset("a1")).toEqual(["impact", "asset", "a1", "all"]);
    expect(queryKeys.impact.asset("a1", { maxDepth: 2 })).toEqual([
      "impact",
      "asset",
      "a1",
      2,
    ]);
  });

  it("returns a new array per call so cache keys compare by value", () => {
    expect(queryKeys.providers.all()).toEqual(queryKeys.providers.all());
    expect(queryKeys.providers.all()).not.toBe(queryKeys.providers.all());
  });
});
