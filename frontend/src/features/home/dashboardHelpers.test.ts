import { describe, expect, it } from "vitest";

import type { Asset, DashboardSummary } from "../../lib/types";
import {
  assetTypeBreakdown,
  dashboardStats,
  generatedAtLabel,
  hasDashboardData,
  jobStatusBreakdown,
  recentAssetRows,
  recentJobRows,
} from "./dashboardHelpers";

const NOW = Date.parse("2026-11-17T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    counts: {
      projects: 3,
      assets: 4,
      conversations: 2,
      jobs: 5,
      providers: 2,
      enabled_extensions: 1,
    },
    generated_at: ago(2),
    jobs_by_status: { queued: 1, running: 2, succeeded: 1, failed: 1, canceled: 0 },
    assets_by_type: { image: 3, video: 1 },
    recent_jobs: [
      {
        id: "job-1",
        project_id: "p1",
        operation_id: "image-to-video",
        schema_version: "1",
        status: "running",
        progress: 42,
        created_by: "u1",
        created_at: ago(5),
      },
    ],
    recent_assets: [
      {
        id: "asset-1",
        project_id: "p1",
        creator_id: "u1",
        type: "image",
        name: "Concept frame",
        status: "ready",
        storage: { key: "Output/frame.png", size_bytes: 1024, content_type: "image/png" },
        created_at: ago(8),
        updated_at: ago(8),
      } as Asset,
    ],
    ...overrides,
  };
}

describe("dashboardStats", () => {
  it("derives the six authoritative counters in a stable order", () => {
    expect(dashboardStats(summary()).map((s) => [s.key, s.value])).toEqual([
      ["projects", 3],
      ["assets", 4],
      ["conversations", 2],
      ["jobs", 5],
      ["providers", 2],
      ["enabled_extensions", 1],
    ]);
  });

  it("is zero-filled and render-safe when no summary is present", () => {
    expect(dashboardStats().every((s) => s.value === 0)).toBe(true);
  });
});

describe("breakdowns", () => {
  it("derives shares from counts and keeps zero-filled categories", () => {
    const rows = jobStatusBreakdown(summary());
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.key === "running")).toMatchObject({ count: 2, percent: 40 });
    expect(rows.find((r) => r.key === "canceled")).toMatchObject({ count: 0, percent: 0 });
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(5);
  });

  it("derives asset type shares and clamps fractions to 0..1", () => {
    const rows = assetTypeBreakdown(summary());
    expect(rows.find((r) => r.key === "image")).toMatchObject({ count: 3, percent: 75 });
    expect(rows.every((r) => r.fraction >= 0 && r.fraction <= 1)).toBe(true);
  });

  it("returns all-zero rows for a missing summary", () => {
    expect(assetTypeBreakdown().every((r) => r.count === 0 && r.percent === 0)).toBe(true);
    expect(jobStatusBreakdown().every((r) => r.count === 0 && r.fraction === 0)).toBe(true);
  });
});

describe("recent rows", () => {
  it("derives recent job display values including tone and progress", () => {
    expect(recentJobRows(summary(), NOW)).toEqual([
      {
        id: "job-1",
        label: "image-to-video",
        status: "running",
        tone: "info",
        progress: 42,
        when: "5 minutes ago",
      },
    ]);
  });

  it("clamps out-of-range job progress", () => {
    const s = summary({
      recent_jobs: [
        {
          id: "job-x",
          project_id: "p1",
          operation_id: "op",
          schema_version: "1",
          status: "running",
          progress: 180,
          created_by: "u1",
          created_at: ago(1),
        },
      ],
    });
    expect(recentJobRows(s, NOW)[0]?.progress).toBe(100);
  });

  it("derives recent asset display values including type tone", () => {
    expect(recentAssetRows(summary(), NOW)).toEqual([
      {
        id: "asset-1",
        name: "Concept frame",
        type: "image",
        tone: "info",
        when: "8 minutes ago",
      },
    ]);
  });

  it("returns empty rows for a missing summary", () => {
    expect(recentJobRows()).toEqual([]);
    expect(recentAssetRows()).toEqual([]);
  });
});

describe("snapshot-level helpers", () => {
  it("formats the generated-at label relatively", () => {
    expect(generatedAtLabel(summary(), NOW)).toBe("2 minutes ago");
    expect(generatedAtLabel(undefined, NOW)).toBe("");
  });

  it("detects populated vs empty snapshots", () => {
    expect(hasDashboardData(summary())).toBe(true);
    expect(
      hasDashboardData(
        summary({
          counts: { projects: 0, assets: 0, conversations: 0, jobs: 0, providers: 0, enabled_extensions: 0 },
          recent_jobs: [],
          recent_assets: [],
        }),
      ),
    ).toBe(false);
    expect(hasDashboardData()).toBe(false);
  });
});
