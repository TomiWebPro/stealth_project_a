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

  it("scopes the project stats key by organization", () => {
    expect(queryKeys.projectStats.summary()).toEqual(["project-stats", "summary", "all"]);
    expect(queryKeys.projectStats.summary({ orgId: "o1" })).toEqual([
      "project-stats",
      "summary",
      "o1",
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
