import { describe, expect, it } from "vitest";

import type { Asset } from "./types";
import {
  ASSET_STATUSES,
  ASSET_TYPES,
  assetStatsQueryParams,
  deriveAssetStats,
  validateAssetStatsArgs,
} from "./assetStats";
import { ASSETS, PROJECTS, REFERENCE_NOW } from "./mock/data";

const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";

function asset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: filmId,
    type: "image",
    name: `asset-${id}`,
    status: "ready",
    creator_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    version: 1,
    storage: { key: `Output/${id}`, size_bytes: 100, content_type: "image/png" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function types(stats: ReturnType<typeof deriveAssetStats>): Record<string, number> {
  return Object.fromEntries((stats.by_type ?? []).map((entry) => [entry.type, entry.count]));
}

function statuses(stats: ReturnType<typeof deriveAssetStats>): Record<string, number> {
  return Object.fromEntries((stats.by_status ?? []).map((entry) => [entry.status, entry.count]));
}

describe("deriveAssetStats", () => {
  it("zero-fills every type and status in canonical order for an empty scope", () => {
    const stats = deriveAssetStats([], REFERENCE_NOW);
    expect(stats.by_type).toEqual(ASSET_TYPES.map((type) => ({ type, count: 0 })));
    expect(stats.by_status).toEqual(ASSET_STATUSES.map((status) => ({ status, count: 0 })));
    expect(stats).toEqual({
      total: 0,
      by_type: ASSET_TYPES.map((type) => ({ type, count: 0 })),
      by_status: ASSET_STATUSES.map((status) => ({ status, count: 0 })),
      total_size_bytes: 0,
      total_versions: 0,
      newest_asset_at: null,
      generated_at: REFERENCE_NOW,
    });
  });

  it("counts live assets by type and status and sums bytes and versions", () => {
    const stats = deriveAssetStats(
      [
        asset("a1", { type: "image", status: "ready", version: 2, storage: { key: "a1", size_bytes: 100, content_type: "image/png" } }),
        asset("a2", { type: "video", status: "ready", storage: { key: "a2", size_bytes: 250, content_type: "video/mp4" } }),
        asset("a3", { type: "image", status: "failed", storage: { key: "a3", size_bytes: 50, content_type: "image/png" } }),
      ],
      REFERENCE_NOW,
    );
    expect(stats.total).toBe(3);
    expect(types(stats)).toMatchObject({ image: 2, video: 1, lora: 0 });
    expect(statuses(stats)).toMatchObject({ ready: 2, failed: 1, deleted: 0 });
    expect(stats.total_size_bytes).toBe(400);
    expect(stats.total_versions).toBe(4);
  });

  it("excludes soft-deleted assets from every metric", () => {
    const stats = deriveAssetStats(
      [
        asset("a1", { status: "ready" }),
        asset("a2", { status: "deleted", version: 9, storage: { key: "a2", size_bytes: 999, content_type: "x" } }),
      ],
      REFERENCE_NOW,
    );
    expect(stats.total).toBe(1);
    expect((stats.by_status ?? []).find((entry) => entry.status === "deleted")?.count).toBe(0);
    expect(stats.total_size_bytes).toBe(100);
    expect(stats.total_versions).toBe(1);
  });

  it("uses the newest live asset created_at as recency with a deterministic id tie-break", () => {
    const stats = deriveAssetStats(
      [
        asset("a1", { created_at: "2026-01-02T00:00:00.000Z" }),
        asset("a2", { created_at: "2026-01-03T00:00:00.000Z" }),
        asset("a3", { created_at: "2026-01-01T00:00:00.000Z", status: "deleted" }),
      ],
      REFERENCE_NOW,
    );
    expect(stats.newest_asset_at).toBe("2026-01-03T00:00:00.000Z");

    const tied = deriveAssetStats(
      [
        asset("a1", { created_at: "2026-01-02T00:00:00.000Z" }),
        asset("a2", { created_at: "2026-01-02T00:00:00.000Z" }),
      ],
      REFERENCE_NOW,
    );
    expect(tied.newest_asset_at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("treats a missing status/version as ready/1 like the backend schema default", () => {
    const partial = asset("a1");
    delete partial.status;
    delete partial.version;
    const stats = deriveAssetStats([partial], REFERENCE_NOW);
    expect(stats.total).toBe(1);
    expect((stats.by_status ?? []).find((entry) => entry.status === "ready")?.count).toBe(1);
    expect(stats.total_versions).toBe(1);
  });

  it("mirrors the backend snapshot over the authoritative seeds", () => {
    const stats = deriveAssetStats(ASSETS, REFERENCE_NOW);
    const live = ASSETS.filter((item) => item.status !== "deleted");
    expect(stats.total).toBe(live.length);
    expect(stats.total_size_bytes).toBe(live.reduce((sum, item) => sum + item.storage.size_bytes, 0));
    expect(stats.total_versions).toBe(live.reduce((sum, item) => sum + (item.version ?? 1), 0));
    expect((stats.by_type ?? []).reduce((sum, entry) => sum + entry.count, 0)).toBe(live.length);
    expect((stats.by_status ?? []).reduce((sum, entry) => sum + entry.count, 0)).toBe(live.length);
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("scopes every metric to one project", () => {
    const stats = deriveAssetStats(ASSETS, REFERENCE_NOW, { projectId: filmId });
    const scoped = ASSETS.filter(
      (item) => item.project_id === filmId && item.status !== "deleted",
    );
    expect(stats.total).toBe(scoped.length);
    expect(stats.total_size_bytes).toBe(scoped.reduce((sum, item) => sum + item.storage.size_bytes, 0));
    expect((stats.by_type ?? []).reduce((sum, entry) => sum + entry.count, 0)).toBe(scoped.length);

    const empty = deriveAssetStats(ASSETS, REFERENCE_NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total).toBe(0);
    expect(empty.newest_asset_at).toBeNull();
  });
});

describe("validateAssetStatsArgs", () => {
  it("rejects a malformed project id with a 422 envelope", () => {
    expect(() => validateAssetStatsArgs({ projectId: "not-a-uuid" })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "project_id" })],
      }),
    );
  });

  it("accepts a valid uuid or an omitted scope", () => {
    expect(() => validateAssetStatsArgs()).not.toThrow();
    expect(() => validateAssetStatsArgs({ projectId: filmId })).not.toThrow();
  });
});

describe("assetStatsQueryParams", () => {
  it("maps the project scope to the authoritative query string", () => {
    expect(assetStatsQueryParams()).toEqual({ project_id: undefined });
    expect(assetStatsQueryParams({ projectId: "p1" })).toEqual({ project_id: "p1" });
  });
});
