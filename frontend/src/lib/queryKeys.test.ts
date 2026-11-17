import { describe, expect, it } from "vitest";

import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  it("builds stable home keys", () => {
    expect(queryKeys.home.summary()).toEqual(["home", "summary"]);
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

  it("returns a new array per call so cache keys compare by value", () => {
    expect(queryKeys.providers.all()).toEqual(queryKeys.providers.all());
    expect(queryKeys.providers.all()).not.toBe(queryKeys.providers.all());
  });
});
