import { describe, expect, it } from "vitest";
import type { Asset, Job, ProjectOverview } from "../../lib/types";
import {
  hasProjectOverviewData,
  projectOverviewCount,
  projectOverviewCountRows,
  projectOverviewGeneratedAtLabel,
  projectOverviewIdentity,
  projectOverviewProgressPercent,
  projectOverviewRecentAssets,
  projectOverviewRecentJobs,
  projectOverviewRelativeLabel,
  projectOverviewSummaryLabel,
} from "./projectOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-aaaa-1111",
    project_id: "proj-aaaa-2222",
    operation_id: "lora_train",
    schema_version: "1",
    status: "running",
    progress: 0.42,
    attempt: 1,
    created_by: "user-aaaa-3333",
    created_at: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-aaaa-1111",
    project_id: "proj-aaaa-2222",
    type: "image",
    name: "Shot 01 keyframe",
    status: "ready",
    creator_id: "user-aaaa-3333",
    version: 2,
    storage: { key: "Projects/Default/Assets/Char/shot01.png", size_bytes: 1024, content_type: "image/png" },
    created_at: "2026-01-01T00:40:00Z",
    updated_at: "2026-01-01T00:42:00Z",
    ...overrides,
  };
}

function overview(overrides: Partial<ProjectOverview> = {}): ProjectOverview {
  return {
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    lifecycle: "active",
    created_at: "2026-01-01T00:00:00Z",
    counts: {
      assets: 12,
      conversations: 3,
      jobs: 9,
      comments: 4,
      publishes: 2,
      versions: 18,
      collaborators: 5,
    },
    recent_jobs: [job()],
    recent_assets: [asset()],
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function emptyOverview(): ProjectOverview {
  return overview({
    counts: {
      assets: 0,
      conversations: 0,
      jobs: 0,
      comments: 0,
      publishes: 0,
      versions: 0,
      collaborators: 0,
    },
    recent_jobs: [],
    recent_assets: [],
  });
}

describe("projectOverview formatters", () => {
  it("formats relative labels defensively", () => {
    expect(projectOverviewRelativeLabel(null)).toBe("");
    expect(projectOverviewRelativeLabel(undefined)).toBe("");
    expect(projectOverviewRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(projectOverviewRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("clamps 0..1 progress into a safe percentage", () => {
    expect(projectOverviewProgressPercent(0)).toBe(0);
    expect(projectOverviewProgressPercent(0.42)).toBe(42);
    expect(projectOverviewProgressPercent(1)).toBe(100);
    expect(projectOverviewProgressPercent(-1)).toBe(0);
    expect(projectOverviewProgressPercent(2)).toBe(100);
    expect(projectOverviewProgressPercent(undefined)).toBe(0);
    expect(projectOverviewProgressPercent(Number.NaN)).toBe(0);
  });

  it("formats the generated-at footer label", () => {
    expect(projectOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
    expect(projectOverviewGeneratedAtLabel(undefined)).toBe("");
  });

  it("zero-fills a single missing count", () => {
    expect(projectOverviewCount(overview(), "assets")).toBe(12);
    expect(projectOverviewCount(undefined, "jobs")).toBe(0);
    expect(projectOverviewCount(emptyOverview(), "comments")).toBe(0);
  });
});

describe("projectOverviewCountRows", () => {
  it("derives all seven cross-domain counters in a stable order", () => {
    const rows = projectOverviewCountRows(overview());
    expect(rows.map((row) => row.key)).toEqual([
      "assets",
      "conversations",
      "jobs",
      "comments",
      "publishes",
      "versions",
      "collaborators",
    ]);
    expect(rows.map((row) => row.value)).toEqual(["12", "3", "9", "4", "2", "18", "5"]);
    expect(rows.every((row) => row.label && row.hint)).toBe(true);
  });

  it("zero-fills every counter when the snapshot is absent", () => {
    expect(projectOverviewCountRows(undefined).map((row) => row.value)).toEqual([
      "0", "0", "0", "0", "0", "0", "0",
    ]);
  });
});

describe("projectOverviewIdentity", () => {
  it("derives the lifecycle badge and recency labels", () => {
    expect(projectOverviewIdentity(overview(), NOW)).toEqual({
      lifecycleLabel: "Active",
      lifecycleTone: "success",
      createdLabel: "1 hour ago",
      generatedLabel: "30 seconds ago",
    });
  });

  it("uses a neutral archived badge", () => {
    const archived = projectOverviewIdentity(overview({ lifecycle: "archived" }), NOW);
    expect(archived.lifecycleLabel).toBe("Archived");
    expect(archived.lifecycleTone).toBe("neutral");
  });

  it("is defensive for a missing snapshot", () => {
    expect(projectOverviewIdentity(undefined, NOW)).toEqual({
      lifecycleLabel: "—",
      lifecycleTone: "neutral",
      createdLabel: "",
      generatedLabel: "",
    });
  });
});

describe("projectOverviewRecentJobs", () => {
  it("projects recent jobs into render-safe rows", () => {
    const rows = projectOverviewRecentJobs(overview(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "job-aaaa-1111",
      operationLabel: "Lora Train",
      statusLabel: "Running",
      statusTone: "info",
      progressPercent: 42,
      relativeTime: "15 minutes ago",
      timestamp: "2026-01-01T00:45:00Z",
    });
  });

  it("returns no rows when the snapshot or recents are absent", () => {
    expect(projectOverviewRecentJobs(undefined)).toEqual([]);
    expect(projectOverviewRecentJobs(overview({ recent_jobs: undefined }))).toEqual([]);
  });
});

describe("projectOverviewRecentAssets", () => {
  it("projects recent assets into render-safe rows", () => {
    const rows = projectOverviewRecentAssets(overview(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "asset-aaaa-1111",
      name: "Shot 01 keyframe",
      typeLabel: "image",
      typeTone: "info",
      versionLabel: "v2",
      relativeTime: "20 minutes ago",
      timestamp: "2026-01-01T00:40:00Z",
    });
  });

  it("defaults a missing asset version to v1", () => {
    const rows = projectOverviewRecentAssets(overview({
      recent_assets: [asset({ version: undefined })],
    }), NOW);
    expect(rows[0]?.versionLabel).toBe("v1");
  });

  it("returns no rows when the snapshot or recents are absent", () => {
    expect(projectOverviewRecentAssets(undefined)).toEqual([]);
    expect(projectOverviewRecentAssets(overview({ recent_assets: undefined }))).toEqual([]);
  });
});

describe("hasProjectOverviewData", () => {
  it("is false for a missing or entirely empty snapshot", () => {
    expect(hasProjectOverviewData(undefined)).toBe(false);
    expect(hasProjectOverviewData(emptyOverview())).toBe(false);
  });

  it("is true when a count or a recent item is present", () => {
    expect(hasProjectOverviewData(overview())).toBe(true);
    expect(hasProjectOverviewData(overview({
      counts: emptyOverview().counts,
      recent_jobs: [job()],
    }))).toBe(true);
    expect(hasProjectOverviewData(overview({
      counts: emptyOverview().counts,
      recent_assets: [asset()],
    }))).toBe(true);
  });
});

describe("projectOverviewSummaryLabel", () => {
  it("summarizes the headline cross-domain counts", () => {
    expect(projectOverviewSummaryLabel(overview())).toBe("12 assets · 9 jobs · 5 collaborators");
    expect(projectOverviewSummaryLabel(undefined)).toBe("");
  });
});
