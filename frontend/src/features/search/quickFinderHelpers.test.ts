import { describe, expect, it } from "vitest";
import type { SearchResult } from "../../types";
import {
  resultEntries,
  resultIcon,
  resultKindLabel,
  resultNavigation,
  screenEntries,
} from "./quickFinderHelpers";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    kind: "project",
    id: "p1",
    title: "Hero Spot",
    subtitle: "A short film",
    project_id: "p1",
    score: 0.9,
    ...overrides,
  };
}

describe("quickFinderHelpers (C23 follow-up)", () => {
  describe("screenEntries", () => {
    it("returns every screen for a blank query", () => {
      const entries = screenEntries("   ");
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((entry) => entry.section === "Screens")).toBe(true);
      expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length);
    });

    it("filters screens case-insensitively by label, description or id", () => {
      expect(screenEntries("jobs").map((entry) => entry.navigation.route)).toEqual(["jobs"]);
      expect(screenEntries("  PROVIDERS ").map((entry) => entry.navigation.route)).toEqual([
        "providers",
      ]);
      expect(screenEntries(" SHARED TEAM ").map((entry) => entry.navigation.route)).toEqual([
        "workspaces",
      ]);
      expect(screenEntries("no-such-screen")).toEqual([]);
    });

    it("carries the nav group label as display context", () => {
      const home = screenEntries("home")[0];
      expect(home?.subtitle).toBe("Workspace");
      expect(home?.icon).toBe("home");
      expect(home?.navigation).toEqual({ route: "home" });
    });
  });

  describe("result kind display values", () => {
    it("maps each kind to a stable label and icon", () => {
      expect(resultKindLabel("project")).toBe("Project");
      expect(resultKindLabel("asset")).toBe("Asset");
      expect(resultKindLabel("conversation")).toBe("Conversation");
      expect(resultIcon("project")).toBe("projects");
      expect(resultIcon("asset")).toBe("assets");
      expect(resultIcon("conversation")).toBe("chat");
    });
  });

  describe("resultNavigation", () => {
    it("deep-links a project result to its detail view", () => {
      expect(resultNavigation(result({ kind: "project", id: "p7" }))).toEqual({
        route: "projects",
        params: { projectId: "p7" },
      });
    });

    it("deep-links an asset result and scopes its project", () => {
      expect(
        resultNavigation(result({ kind: "asset", id: "a9", project_id: "p3" })),
      ).toEqual({
        route: "assets",
        params: { assetId: "a9" },
        assetsProjectId: "p3",
      });
    });

    it("omits the asset project scope when the result has none", () => {
      expect(
        resultNavigation(result({ kind: "asset", id: "a9", project_id: null })),
      ).toEqual({
        route: "assets",
        params: { assetId: "a9" },
        assetsProjectId: undefined,
      });
    });

    it("deep-links a conversation result to chat", () => {
      expect(
        resultNavigation(result({ kind: "conversation", id: "c2", project_id: "p1" })),
      ).toEqual({ route: "chat", params: { conversationId: "c2" } });
    });
  });

  describe("resultEntries", () => {
    it("treats missing or empty results as no rows", () => {
      expect(resultEntries(undefined)).toEqual([]);
      expect(resultEntries([])).toEqual([]);
    });

    it("maps ranked results to render-ready rows in order", () => {
      const entries = resultEntries([
        result({ kind: "project", id: "p1", title: "Hero", subtitle: " film " }),
        result({ kind: "asset", id: "a2", title: "Frame", subtitle: null, project_id: "p1" }),
      ]);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toMatchObject({
        key: "result:project:p1",
        section: "Results",
        label: "Hero",
        subtitle: "film",
        icon: "projects",
        badge: "Project",
      });
      expect(entries[1]).toMatchObject({
        key: "result:asset:a2",
        label: "Frame",
        subtitle: "",
        icon: "assets",
        badge: "Asset",
      });
    });

    it("produces unique keys even for the same id across kinds", () => {
      const entries = resultEntries([
        result({ kind: "project", id: "same" }),
        result({ kind: "asset", id: "same" }),
        result({ kind: "conversation", id: "same" }),
      ]);
      expect(new Set(entries.map((entry) => entry.key)).size).toBe(3);
    });
  });
});
