import { describe, expect, it } from "vitest";
import type { ProjectFeed, ProjectFeedItem } from "../../lib/types";
import {
  buildProjectFeedOptions,
  PROJECT_FEED_LIFECYCLE_FILTERS,
  PROJECT_FEED_LIMITS,
  projectFeedDescriptionLabel,
  projectFeedEmptyDescription,
  projectFeedGeneratedAtLabel,
  projectFeedLifecycleChipLabel,
  projectFeedLifecycleLabel,
  projectFeedLifecycleTone,
  projectFeedRows,
  projectFeedSummary,
} from "./projectFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<ProjectFeedItem> = {}): ProjectFeedItem {
  return {
    project_id: "proj-aaaa-1111",
    org_id: "org-aaaa-2222",
    org_name: "Acme Studio",
    name: "A Short Film",
    description: "A moody short film",
    lifecycle: "active",
    created_by: "user-aaaa-3333",
    created_at: "2026-01-01T00:45:00Z",
    updated_at: "2026-01-01T00:50:00Z",
    ...overrides,
  };
}

function feed(items: readonly ProjectFeedItem[], total = items.length): ProjectFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("buildProjectFeedOptions", () => {
  it("omits both scopes when unscoped", () => {
    expect(buildProjectFeedOptions(undefined, undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the org and lifecycle scopes when provided", () => {
    expect(buildProjectFeedOptions("org-aaaa-2222", "archived", 10)).toEqual({
      orgId: "org-aaaa-2222",
      lifecycle: "archived",
      limit: 10,
    });
  });

  it("offers the canonical page sizes and lifecycle chips", () => {
    expect(PROJECT_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(PROJECT_FEED_LIFECYCLE_FILTERS).toEqual([undefined, "active", "archived"]);
  });
});

describe("projectFeedLifecycleLabel / projectFeedLifecycleTone", () => {
  it("labels and tones each canonical lifecycle", () => {
    expect(projectFeedLifecycleLabel("active")).toBe("Active");
    expect(projectFeedLifecycleLabel("archived")).toBe("Archived");
    expect(projectFeedLifecycleTone("active")).toBe("success");
    expect(projectFeedLifecycleTone("archived")).toBe("neutral");
  });

  it("labels the unfiltered lifecycle chip", () => {
    expect(projectFeedLifecycleChipLabel(undefined)).toBe("All");
    expect(projectFeedLifecycleChipLabel("active")).toBe("Active");
    expect(projectFeedLifecycleChipLabel("archived")).toBe("Archived");
  });
});

describe("projectFeedDescriptionLabel", () => {
  it("returns the trimmed description or a defensive fallback", () => {
    expect(projectFeedDescriptionLabel("  A moody short film  ")).toBe("A moody short film");
    expect(projectFeedDescriptionLabel("   ")).toBe("No description");
    expect(projectFeedDescriptionLabel(null)).toBe("No description");
    expect(projectFeedDescriptionLabel(undefined)).toBe("No description");
  });
});

describe("projectFeedRows", () => {
  it("returns an empty list for an unset or failed feed", () => {
    expect(projectFeedRows(undefined, NOW)).toEqual([]);
    expect(projectFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" }, NOW)).toEqual([]);
  });

  it("derives render-ready rows while preserving newest-first order", () => {
    const rows = projectFeedRows(
      feed([
        item(),
        item({
          project_id: "proj-bbbb-2222",
          org_id: "org-bbbb-3333",
          org_name: "Indie Collective",
          name: "Trailer",
          description: null,
          lifecycle: "archived",
          created_at: "2026-01-01T00:20:00Z",
        }),
      ]),
      NOW,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.projectId)).toEqual(["proj-aaaa-1111", "proj-bbbb-2222"]);
    expect(rows[0]).toMatchObject({
      id: "proj-aaaa-1111",
      projectId: "proj-aaaa-1111",
      orgId: "org-aaaa-2222",
      orgName: "Acme Studio",
      name: "A Short Film",
      descriptionLabel: "A moody short film",
      lifecycle: "active",
      lifecycleLabel: "Active",
      lifecycleTone: "success",
      timestamp: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      descriptionLabel: "No description",
      lifecycle: "archived",
      lifecycleLabel: "Archived",
      lifecycleTone: "neutral",
    });
  });
});

describe("projectFeedSummary", () => {
  it("uses the whole-scope total and the newest project name", () => {
    const rows = projectFeedRows(feed([item()], 42), NOW);
    expect(projectFeedSummary(rows, 42)).toBe("42 projects · latest: A Short Film");
  });

  it("falls back to the visible row count and handles a single row", () => {
    const rows = projectFeedRows(feed([item()]), NOW);
    expect(projectFeedSummary(rows)).toBe("1 project · latest: A Short Film");
  });

  it("reports an empty summary when there are no rows", () => {
    expect(projectFeedSummary([])).toBe("No projects");
  });
});

describe("projectFeedGeneratedAtLabel", () => {
  it("formats a generated-at timestamp relative to now", () => {
    expect(projectFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
  });

  it("returns an empty label when the feed is missing", () => {
    expect(projectFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("projectFeedEmptyDescription", () => {
  it("is scope- and filter-aware", () => {
    expect(projectFeedEmptyDescription(false, false)).toContain("created in the studio");
    expect(projectFeedEmptyDescription(true, false)).toContain("this organization");
    expect(projectFeedEmptyDescription(true, true)).toContain("lifecycle filter");
  });
});
