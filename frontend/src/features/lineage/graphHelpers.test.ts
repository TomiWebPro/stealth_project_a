import { describe, expect, it } from "vitest";
import type { Asset } from "../../lib/types";
import { buildGraphLayers, graphSummary } from "./graphHelpers";

function asset(id: string, parentIds: string[] = [], overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: "p1",
    type: "image",
    name: `Asset ${id}`,
    creator_id: "u1",
    storage: { key: `assets/${id}`, size_bytes: 1, content_type: "image/png" },
    parent_asset_ids: parentIds,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("graph helpers", () => {
  it("layers nodes by parent depth and links children", () => {
    const layers = buildGraphLayers([
      asset("a"),
      asset("b", ["a"]),
      asset("c", ["b"]),
    ]);
    expect(layers.map((layer) => layer.nodes.map((node) => node.id))).toEqual([["a"], ["b"], ["c"]]);
    expect(layers[0]?.nodes[0]?.childIds).toEqual(["b"]);
    expect(graphSummary(layers)).toBe("3 nodes across 3 levels");
  });

  it("handles cycles without infinite recursion", () => {
    const layers = buildGraphLayers([asset("a", ["b"]), asset("b", ["a"])]);
    expect(layers.length).toBeGreaterThan(0);
  });

  it("reports an empty graph", () => {
    expect(buildGraphLayers([])).toEqual([]);
    expect(graphSummary([])).toBe("No graph nodes");
  });
});
