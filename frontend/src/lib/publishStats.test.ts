import { describe, expect, it } from "vitest";

import {
  derivePublishStats,
  publishStatsQueryParams,
  validatePublishStatsArgs,
} from "./publishStats";
import type { Asset, AssetStatus, Metadata } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const A1 = "0b5c1e2a-2000-4000-8000-000000000001";
const A2 = "0b5c1e2a-2000-4000-8000-000000000002";
const A3 = "0b5c1e2a-2000-4000-8000-000000000003";

function asset(
  id: string,
  projectId: string,
  receipt?: Metadata,
  status: AssetStatus = "ready",
): Asset {
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
    ...(receipt !== undefined ? { metadata: { publish_receipt: receipt } } : {}),
  };
}

function receipt(version: number, sizeBytes: number, publishedAt: string): Metadata {
  return { version, size_bytes: sizeBytes, published_at: publishedAt };
}

const ASSETS = [
  asset(A1, P1, receipt(1, 100, "2026-03-18T08:00:00.000Z")),
  asset(A2, P2, receipt(1, 200, "2026-03-18T07:00:00.000Z")),
  asset(A2, P2, receipt(2, 300, "2026-03-18T09:00:00.000Z")),
  asset(A3, P2, receipt(1, 400, "2026-03-18T06:00:00.000Z")),
];

describe("derivePublishStats", () => {
  it("returns zero counts, empty breakdowns and a null recency when nothing is published", () => {
    expect(derivePublishStats([], NOW)).toEqual({
      total_published: 0,
      total_bytes: 0,
      by_version: [],
      by_project: [],
      newest_published_at: null,
      generated_at: NOW,
    });
  });

  it("groups by ascending version, sorts projects by descending publishes then id and finds recency", () => {
    const stats = derivePublishStats([...ASSETS].reverse(), NOW);

    expect(stats.total_published).toBe(4);
    expect(stats.total_bytes).toBe(1000);
    expect(stats.by_version).toEqual([
      { version: 1, count: 3 },
      { version: 2, count: 1 },
    ]);
    // P2 has 3 publishes / 900 bytes, P1 has 1 / 100 — descending count.
    expect(stats.by_project).toEqual([
      { project_id: P2, published: 3, bytes: 900 },
      { project_id: P1, published: 1, bytes: 100 },
    ]);
    expect(stats.newest_published_at).toBe("2026-03-18T09:00:00.000Z");
    expect(stats.generated_at).toBe(NOW);
    expect(derivePublishStats(ASSETS, NOW)).toEqual(stats);
  });

  it("breaks per-project ties by project id", () => {
    const tied = [
      asset(A1, P1, receipt(1, 100, "2026-03-18T08:00:00.000Z")),
      asset(A2, P2, receipt(1, 200, "2026-03-18T07:00:00.000Z")),
    ];
    expect(derivePublishStats(tied, NOW).by_project?.map((entry) => entry.project_id)).toEqual([
      P1,
      P2,
    ]);
  });

  it("excludes soft-deleted and malformed receipts and scopes to one project", () => {
    const malformed = [
      asset(A1, P1, { version: true, size_bytes: 10, published_at: "2026-03-18T10:00:00.000Z" }),
      asset(A1, P1, { version: 1, size_bytes: -1, published_at: "2026-03-18T10:00:00.000Z" }),
      asset(A1, P1, { version: 1, size_bytes: 10, published_at: "not-a-date" }),
      asset(A1, P1, undefined),
    ];
    // The malformed receipts carry a newer date — none may leak into recency.
    const all = derivePublishStats([...ASSETS, ...malformed], NOW);
    expect(all.total_published).toBe(4);
    expect(all.total_bytes).toBe(1000);
    expect(all.newest_published_at).toBe("2026-03-18T09:00:00.000Z");

    const deleted = ASSETS.map((candidate) =>
      candidate.project_id === P2 ? { ...candidate, status: "deleted" as const } : candidate,
    );
    const withDeleted = derivePublishStats(deleted, NOW);
    expect(withDeleted.total_published).toBe(1);
    expect(withDeleted.total_bytes).toBe(100);
    expect(withDeleted.by_project).toEqual([{ project_id: P1, published: 1, bytes: 100 }]);
    expect(withDeleted.newest_published_at).toBe("2026-03-18T08:00:00.000Z");

    const scoped = derivePublishStats(ASSETS, NOW, { projectId: P2 });
    expect(scoped.total_published).toBe(3);
    expect(scoped.total_bytes).toBe(900);
    expect(scoped.by_project).toEqual([{ project_id: P2, published: 3, bytes: 900 }]);
    expect(scoped.newest_published_at).toBe("2026-03-18T09:00:00.000Z");

    const empty = derivePublishStats(ASSETS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_published).toBe(0);
    expect(empty.total_bytes).toBe(0);
    expect(empty.by_version).toEqual([]);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_published_at).toBeNull();
  });
});

describe("publish stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validatePublishStatsArgs()).not.toThrow();
    expect(() => validatePublishStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validatePublishStatsArgs({ projectId: "not-a-uuid" });
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
    expect(publishStatsQueryParams()).toEqual({ project_id: undefined });
    expect(publishStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
