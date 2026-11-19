import { describe, expect, it } from "vitest";

import {
  deriveLineageStats,
  LINEAGE_RELATIONSHIP_TYPES,
  lineageStatsQueryParams,
  validateLineageStatsArgs,
} from "./lineageStats";
import type { AssetRelationshipRecord } from "./lineageStats";
import type { Asset } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";

function asset(id: string, projectId: string, status: Asset["status"] = "ready"): Asset {
  return {
    id,
    project_id: projectId,
    status,
    name: id,
    type: "image",
    storage: { key: id, size_bytes: 1, content_type: "image/png" },
    created_at: NOW,
    updated_at: NOW,
    tags: [],
    parent_asset_ids: [],
    provenance: {},
    metadata: {},
    version: 1,
  } as unknown as Asset;
}

function rel(
  id: string,
  from: string,
  to: string,
  type: AssetRelationshipRecord["type"],
  createdAt: string,
): AssetRelationshipRecord {
  return { id, from_asset_id: from, to_asset_id: to, type, created_at: createdAt };
}

const A1 = "0b5c1e2a-2000-4000-8000-000000000001";
const A2 = "0b5c1e2a-2000-4000-8000-000000000002";
const A3 = "0b5c1e2a-2000-4000-8000-000000000003";
const A4 = "0b5c1e2a-2000-4000-8000-000000000004";
const DELETED = "0b5c1e2a-2000-4000-8000-0000000000de";
const UNKNOWN = "0b5c1e2a-2000-4000-8000-0000000000ff";

const ASSETS = [
  asset(A1, P1),
  asset(A2, P1),
  asset(A3, P2),
  asset(A4, P2),
  asset(DELETED, P1, "deleted"),
];

describe("deriveLineageStats", () => {
  it("zero-fills every relationship type for an empty link set", () => {
    expect(deriveLineageStats([], ASSETS, NOW)).toEqual({
      total_relationships: 0,
      total_linked_assets: 0,
      by_type: LINEAGE_RELATIONSHIP_TYPES.map((type) => ({ type, count: 0 })),
      by_project: [],
      newest_relationship_at: null,
      generated_at: NOW,
    });
  });

  it("derives zero-filled type counts, project counts, live-asset count and recency", () => {
    // Unsorted input proves the derivation does not depend on store order.
    const stats = deriveLineageStats(
      [
        rel("00000000-0000-4000-8000-000000000003", A1, A3, "derived_from", "2026-03-18T09:00:00.000Z"),
        rel("00000000-0000-4000-8000-000000000001", A1, A2, "derived_from", "2026-03-18T08:00:00.000Z"),
        rel("00000000-0000-4000-8000-000000000002", A3, A2, "uses_input", NOW),
        rel("00000000-0000-4000-8000-000000000004", A3, A2, "variant_of", "2026-03-18T07:00:00.000Z"),
      ],
      ASSETS,
      NOW,
    );
    expect(stats.total_relationships).toBe(4);
    expect(stats.by_type).toEqual([
      { type: "derived_from", count: 2 },
      { type: "variant_of", count: 1 },
      { type: "uses_input", count: 1 },
      { type: "related_to", count: 0 },
      { type: "duplicate_of", count: 0 },
    ]);
    // Most-linked project first, then project id for a deterministic tie-break.
    expect(stats.by_project).toEqual([
      { project_id: P1, relationships: 2 },
      { project_id: P2, relationships: 2 },
    ]);
    // A1, A2 and A3 are all live endpoints (A1 twice, A2 three times).
    expect(stats.total_linked_assets).toBe(3);
    expect(stats.newest_relationship_at).toBe(NOW);
    expect(stats.generated_at).toBe(NOW);
  });

  it("excludes links from deleted/unknown sources and ignores unknown targets", () => {
    const stats = deriveLineageStats(
      [
        rel("00000000-0000-4000-8000-000000000001", A1, UNKNOWN, "related_to", NOW),
        rel("00000000-0000-4000-8000-000000000002", DELETED, A2, "derived_from", NOW),
        rel("00000000-0000-4000-8000-000000000003", UNKNOWN, A2, "derived_from", NOW),
      ],
      ASSETS,
      NOW,
    );
    // Only the A1 -> unknown link survives (live source); its unknown target is
    // counted as a relationship but not as a linked asset.
    expect(stats.total_relationships).toBe(1);
    expect(stats.total_linked_assets).toBe(1);
    expect(stats.by_type).toEqual([
      { type: "derived_from", count: 0 },
      { type: "variant_of", count: 0 },
      { type: "uses_input", count: 0 },
      { type: "related_to", count: 1 },
      { type: "duplicate_of", count: 0 },
    ]);
    expect(stats.by_project).toEqual([{ project_id: P1, relationships: 1 }]);
  });

  it("is deterministic under input reordering, including recency ties", () => {
    const lower = rel("00000000-0000-4000-8000-000000000001", A1, A2, "derived_from", NOW);
    const higher = rel("00000000-0000-4000-8000-000000000002", A1, A2, "derived_from", NOW);
    expect(deriveLineageStats([lower, higher], ASSETS, NOW)).toEqual(
      deriveLineageStats([higher, lower], ASSETS, NOW),
    );
    expect(deriveLineageStats([lower, higher], ASSETS, NOW).newest_relationship_at).toBe(NOW);
  });

  it("scopes the derivation to one project without mutating the global seed", () => {
    const all = [
      rel("00000000-0000-4000-8000-000000000001", A1, A2, "derived_from", NOW),
      rel("00000000-0000-4000-8000-000000000002", A3, A1, "uses_input", NOW),
    ];
    const scoped = deriveLineageStats(all, ASSETS, NOW, { projectId: P2 });
    expect(scoped.total_relationships).toBe(1);
    expect(scoped.by_project).toEqual([{ project_id: P2, relationships: 1 }]);
    expect(scoped.total_linked_assets).toBe(2);

    // A valid but unseeded project yields the zero-filled empty snapshot.
    const empty = deriveLineageStats(all, ASSETS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_relationships).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_relationship_at).toBeNull();
  });
});

describe("lineage stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateLineageStatsArgs()).not.toThrow();
    expect(() => validateLineageStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateLineageStatsArgs({ projectId: "not-a-uuid" });
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
    expect(lineageStatsQueryParams()).toEqual({ project_id: undefined });
    expect(lineageStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
