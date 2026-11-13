import { describe, expect, it } from "vitest";

import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  it("builds stable home keys", () => {
    expect(queryKeys.home.summary()).toEqual(["home", "summary"]);
  });

  it("scopes project keys by id", () => {
    expect(queryKeys.projects.all()).toEqual(["projects"]);
    expect(queryKeys.projects.detail("p1")).toEqual(["projects", "detail", "p1"]);
  });

  it("scopes asset keys by limit", () => {
    expect(queryKeys.assets.recent(10)).toEqual(["assets", "recent", 10]);
  });

  it("returns a new array per call so cache keys compare by value", () => {
    expect(queryKeys.providers.all()).toEqual(queryKeys.providers.all());
    expect(queryKeys.providers.all()).not.toBe(queryKeys.providers.all());
  });
});
