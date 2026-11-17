import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import {
  ASSET_TYPES,
  DEFAULT_RECENT_LIMIT,
  JOB_STATUSES,
  dashboardQueryParams,
  deriveDashboardSummary,
  validateDashboardArgs,
} from "./dashboard";
import type { DashboardSeeds } from "./dashboard";
import {
  ASSETS,
  CONVERSATIONS,
  EXTENSIONS,
  JOBS,
  PROJECTS,
  PROVIDERS,
  REFERENCE_NOW,
} from "./mock/data";

const seeded: DashboardSeeds = {
  projects: PROJECTS,
  assets: ASSETS,
  conversations: CONVERSATIONS,
  jobs: JOBS,
  providers: PROVIDERS,
  extensions: EXTENSIONS,
  now: REFERENCE_NOW,
};

describe("dashboard derivation", () => {
  it("mirrors the backend counts, zero-filled breakdowns and recency", () => {
    const summary = deriveDashboardSummary(seeded);

    expect(summary.generated_at).toBe(REFERENCE_NOW);
    expect(summary.counts).toEqual({
      projects: PROJECTS.length,
      assets: ASSETS.length,
      conversations: CONVERSATIONS.length,
      jobs: JOBS.length,
      providers: PROVIDERS.length,
      enabled_extensions: EXTENSIONS.filter((extension) => extension.status === "enabled").length,
    });
    expect(Object.keys(summary.jobs_by_status ?? {}).sort()).toEqual([...JOB_STATUSES].sort());
    expect(Object.keys(summary.assets_by_type ?? {}).sort()).toEqual([...ASSET_TYPES].sort());

    const statusTotal = Object.values(summary.jobs_by_status ?? {}).reduce((a, b) => a + b, 0);
    const typeTotal = Object.values(summary.assets_by_type ?? {}).reduce((a, b) => a + b, 0);
    expect(statusTotal).toBe(JOBS.length);
    expect(typeTotal).toBe(ASSETS.length);
    expect(summary.recent_jobs).toHaveLength(Math.min(DEFAULT_RECENT_LIMIT, JOBS.length));
    expect(summary.recent_assets).toHaveLength(Math.min(DEFAULT_RECENT_LIMIT, ASSETS.length));
  });

  it("returns newest-first recents and honours recent_limit", () => {
    const summary = deriveDashboardSummary(seeded, { recentLimit: 2 });
    expect(summary.recent_jobs).toHaveLength(2);
    expect(summary.recent_assets).toHaveLength(2);
    for (const rows of [summary.recent_jobs ?? [], summary.recent_assets ?? []]) {
      expect(rows[0]!.created_at >= rows[1]!.created_at).toBe(true);
    }
  });

  it("excludes deleted assets from counts, breakdowns and recency", () => {
    const deleted = {
      ...ASSETS[0]!,
      id: "deleted-asset",
      name: "Deleted",
      status: "deleted" as const,
      created_at: "2099-01-01T00:00:00Z",
    };
    const summary = deriveDashboardSummary({ ...seeded, assets: [...ASSETS, deleted] });
    expect(summary.counts.assets).toBe(ASSETS.length);
    expect(summary.recent_assets?.some((asset) => asset.id === deleted.id)).toBe(false);
    expect(summary.assets_by_type?.[deleted.type]).toBe(
      ASSETS.filter((asset) => asset.type === deleted.type).length,
    );
  });

  it("returns an all-zero snapshot for an empty workspace (never an error)", () => {
    const summary = deriveDashboardSummary({
      projects: [],
      assets: [],
      conversations: [],
      jobs: [],
      providers: [],
      extensions: [],
      now: REFERENCE_NOW,
    });
    expect(summary.counts).toEqual({
      projects: 0,
      assets: 0,
      conversations: 0,
      jobs: 0,
      providers: 0,
      enabled_extensions: 0,
    });
    expect(Object.values(summary.jobs_by_status ?? {}).every((value) => value === 0)).toBe(true);
    expect(Object.values(summary.assets_by_type ?? {}).every((value) => value === 0)).toBe(true);
    expect(summary.recent_jobs).toEqual([]);
    expect(summary.recent_assets).toEqual([]);
  });
});

describe("dashboard query helpers", () => {
  it("mirrors the router's recent_limit validation", () => {
    expect(() => validateDashboardArgs()).not.toThrow();
    expect(() => validateDashboardArgs(1)).not.toThrow();
    expect(() => validateDashboardArgs(50)).not.toThrow();
    for (const invalid of [0, 51, -1, 1.5, Number.NaN]) {
      expect(() => validateDashboardArgs(invalid)).toThrowError(ApiError);
    }
    try {
      validateDashboardArgs(0);
    } catch (cause) {
      expect(cause).toMatchObject({
        status: 422,
        code: "validation_error",
        details: [{ field: "recent_limit" }],
      });
    }
  });

  it("maps the option to the live query string", () => {
    expect(dashboardQueryParams()).toEqual({ recent_limit: undefined });
    expect(dashboardQueryParams({ recentLimit: 10 })).toEqual({ recent_limit: 10 });
  });
});
