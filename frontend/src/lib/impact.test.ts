import { describe, expect, it } from "vitest";

import type { Asset, AssetStatus } from "./types";
import { deriveAssetImpact, impactQueryParams, validateImpactArgs } from "./impact";

const ROOT = "0b5c1e2a-4000-4000-8000-000000000001";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";

function asset(
  id: string,
  parents: string[],
  minutesAgo: number,
  status: AssetStatus = "ready",
): Asset {
  const createdAt = new Date(Date.parse("2026-01-01T00:00:00.000Z") + minutesAgo * 60_000).toISOString();
  return {
    id,
    project_id: "0b5c1e2a-1000-4000-8000-000000000005",
    type: "image",
    name: id,
    creator_id: CREATOR,
    storage: { key: `Output/${id}`, size_bytes: 1, content_type: "image/png" },
    created_at: createdAt,
    updated_at: createdAt,
    parent_asset_ids: parents,
    status,
  };
}

const CHILD_1 = "0b5c1e2a-4000-4000-8000-000000000002";
const CHILD_2 = "0b5c1e2a-4000-4000-8000-000000000003";
const GRANDCHILD = "0b5c1e2a-4000-4000-8000-000000000004";
const DELETED = "0b5c1e2a-4000-4000-8000-000000000005";
const DELETED_CHILD = "0b5c1e2a-4000-4000-8000-000000000006";

const chain: Asset[] = [
  asset(ROOT, [], 0),
  asset(CHILD_1, [ROOT], 1),
  asset(CHILD_2, [ROOT], 2),
  asset(GRANDCHILD, [CHILD_1], 3),
  asset(DELETED, [ROOT], 4, "deleted"),
  asset(DELETED_CHILD, [DELETED], 5),
];

describe("deriveAssetImpact", () => {
  it("returns breadth-first descendants with depth labels and a pre-limit total", () => {
    const impact = deriveAssetImpact(ROOT, chain);
    expect(impact.root_asset_id).toBe(ROOT);
    expect(impact.descendants).toEqual([
      { asset_id: CHILD_1, relationship: "derived_from", depth: 1 },
      { asset_id: CHILD_2, relationship: "derived_from", depth: 1 },
      { asset_id: GRANDCHILD, relationship: "derived_from", depth: 2 },
    ]);
    expect(impact.total).toBe(3);
  });

  it("bounds traversal by maxDepth without changing the root", () => {
    expect(deriveAssetImpact(ROOT, chain, { maxDepth: 1 })).toEqual({
      root_asset_id: ROOT,
      descendants: [
        { asset_id: CHILD_1, relationship: "derived_from", depth: 1 },
        { asset_id: CHILD_2, relationship: "derived_from", depth: 1 },
      ],
      total: 2,
    });
  });

  it("excludes deleted descendants and their whole subtree", () => {
    const ids = (deriveAssetImpact(ROOT, chain).descendants ?? []).map((node) => node.asset_id);
    expect(ids).not.toContain(DELETED);
    expect(ids).not.toContain(DELETED_CHILD);
  });

  it("is cycle-safe when two assets derive from each other", () => {
    const impact = deriveAssetImpact(ROOT, [
      asset(ROOT, [CHILD_1], 0),
      asset(CHILD_1, [ROOT], 1),
    ]);
    expect(impact.descendants).toEqual([
      { asset_id: CHILD_1, relationship: "derived_from", depth: 1 },
    ]);
  });

  it("returns an empty impact for a leaf root", () => {
    expect(deriveAssetImpact(ROOT, [asset(ROOT, [], 0)])).toEqual({
      root_asset_id: ROOT,
      descendants: [],
      total: 0,
    });
  });
});

describe("validateImpactArgs", () => {
  it("rejects a malformed asset id and out-of-range max_depth with 422", () => {
    expect(() => validateImpactArgs("not-a-uuid")).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "asset_id" })],
      }),
    );
    for (const maxDepth of [0, 21]) {
      expect(() => validateImpactArgs(ROOT, { maxDepth })).toThrowError(
        expect.objectContaining({
          status: 422,
          details: [expect.objectContaining({ field: "max_depth" })],
        }),
      );
    }
  });

  it("accepts a valid asset id and omitted or in-range depth", () => {
    expect(() => validateImpactArgs(ROOT)).not.toThrow();
    expect(() => validateImpactArgs(ROOT, { maxDepth: 1 })).not.toThrow();
  });
});

describe("impactQueryParams", () => {
  it("maps maxDepth to the authoritative query string", () => {
    expect(impactQueryParams()).toEqual({ max_depth: undefined });
    expect(impactQueryParams({ maxDepth: 3 })).toEqual({ max_depth: 3 });
  });
});
