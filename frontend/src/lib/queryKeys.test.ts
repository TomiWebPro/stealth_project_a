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

  it("returns a new array per call so cache keys compare by value", () => {
    expect(queryKeys.providers.all()).toEqual(queryKeys.providers.all());
    expect(queryKeys.providers.all()).not.toBe(queryKeys.providers.all());
  });
});
