import { describe, expect, it } from "vitest";

import {
  deriveVersionStats,
  validateVersionStatsArgs,
  versionStatsQueryParams,
} from "./versionStats";
import type { AssetVersionRecord } from "./versionStats";
import type { Asset, AssetStatus } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const A1 = "0b5c1e2a-2000-4000-8000-000000000001";
const A2 = "0b5c1e2a-2000-4000-8000-000000000002";
const A3 = "0b5c1e2a-2000-4000-8000-000000000003";

function asset(id: string, projectId: string, status: AssetStatus = "ready"): Asset {
  return {
    id,
    project_id: projectId,
    type: "image",
    name: `asset-${id}`,
    status,
    creator_id: "0b5c1e2a-0000-4000-8000-0000000000aa",
    version: 1,
    tags: [],
    storage: { key: `assets/${id}.png`, size_bytes: 1024, content_type: "image/png" },
    created_at: "2026-03-18T08:00:00.000Z",
    updated_at: "2026-03-18T08:00:00.000Z",
  };
}

function version(assetId: string, number: number, createdAt: string): AssetVersionRecord {
  return { asset_id: assetId, version: number, created_at: createdAt };
}

const ASSETS = [asset(A1, P1), asset(A2, P2), asset(A3, P2)];

const VERSIONS = [
  version(A1, 1, "2026-03-18T08:00:00.000Z"),
  version(A2, 1, "2026-03-18T07:00:00.000Z"),
  version(A2, 2, "2026-03-18T09:00:00.000Z"),
  version(A3, 1, "2026-03-18T06:00:00.000Z"),
];

describe("deriveVersionStats", () => {
  it("returns zero counts, empty breakdowns and a null recency when there are no versions", () => {
    expect(deriveVersionStats([], ASSETS, NOW)).toEqual({
      total_versions: 0,
      total_assets: 0,
      revisions: 0,
      by_version: [],
      by_project: [],
      newest_version_at: null,
      generated_at: NOW,
    });
  });

  it("groups by ascending version, sorts projects by descending versions then id, and finds recency", () => {
    // Unsorted input proves version buckets and the recency marker are order-independent.
    const stats = deriveVersionStats([...VERSIONS].reverse(), ASSETS, NOW);

    expect(stats.total_versions).toBe(4);
    expect(stats.total_assets).toBe(3);
    expect(stats.revisions).toBe(1);
    expect(stats.by_version).toEqual([
      { version: 1, count: 3 },
      { version: 2, count: 1 },
    ]);
    // P2 has 3 versions / 2 assets, P1 has 1 / 1 — descending version count.
    expect(stats.by_project).toEqual([
      { project_id: P2, versions: 3, assets: 2 },
      { project_id: P1, versions: 1, assets: 1 },
    ]);
    expect(stats.newest_version_at).toBe("2026-03-18T09:00:00.000Z");
    expect(stats.generated_at).toBe(NOW);
    expect(deriveVersionStats(VERSIONS, ASSETS, NOW)).toEqual(stats);
  });

  it("breaks per-project ties by project id", () => {
    const tied = [version(A1, 1, "2026-03-18T08:00:00.000Z"), version(A2, 1, "2026-03-18T07:00:00.000Z")];
    expect(deriveVersionStats(tied, ASSETS, NOW).by_project?.map((entry) => entry.project_id)).toEqual([
      P1,
      P2,
    ]);
  });

  it("excludes soft-deleted/unknown-asset records and scopes to one project", () => {
    const withOrphans = [
      ...VERSIONS,
      version("0b5c1e2a-2000-4000-8000-0000000000ff", 5, "2026-03-18T10:00:00.000Z"),
    ];
    const deletedAssets = ASSETS.map((candidate) =>
      candidate.id === A3 ? asset(A3, P2, "deleted") : candidate,
    );

    const all = deriveVersionStats(withOrphans, deletedAssets, NOW);
    expect(all.total_versions).toBe(3); // A3's v1 record excluded (asset deleted), orphan excluded
    expect(all.total_assets).toBe(2);
    expect(all.by_project).toEqual([
      { project_id: P2, versions: 2, assets: 1 },
      { project_id: P1, versions: 1, assets: 1 },
    ]);
    // The excluded orphan carried the newest created_at — must not leak into recency.
    expect(all.newest_version_at).toBe("2026-03-18T09:00:00.000Z");

    const scoped = deriveVersionStats(withOrphans, deletedAssets, NOW, { projectId: P2 });
    expect(scoped.total_versions).toBe(2);
    expect(scoped.total_assets).toBe(1);
    expect(scoped.by_project).toEqual([{ project_id: P2, versions: 2, assets: 1 }]);
    expect(scoped.newest_version_at).toBe("2026-03-18T09:00:00.000Z");

    const empty = deriveVersionStats(withOrphans, deletedAssets, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_versions).toBe(0);
    expect(empty.by_version).toEqual([]);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_version_at).toBeNull();
  });

  it("breaks recency ties by asset id for deterministic cross-backend ordering", () => {
    const tied = [
      version(A2, 1, "2026-03-18T09:00:00.000Z"),
      version(A1, 1, "2026-03-18T09:00:00.000Z"),
    ];
    expect(deriveVersionStats(tied, ASSETS, NOW).newest_version_at).toBe(
      "2026-03-18T09:00:00.000Z",
    );
  });
});

describe("version stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateVersionStatsArgs()).not.toThrow();
    expect(() => validateVersionStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateVersionStatsArgs({ projectId: "not-a-uuid" });
      throw new Error("expected validation to fail");
    } catch (cause) {
      expect(cause).toMatchObject({
        status: 422,
        code: "validation_error",
        details: [{ field: "project_id" }],
      });
    }
  });

  it("maps the project scope onto the live query string", () => {
    expect(versionStatsQueryParams()).toEqual({ project_id: undefined });
    expect(versionStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
