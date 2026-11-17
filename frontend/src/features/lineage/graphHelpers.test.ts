import { describe, expect, it } from "vitest";
import type { Asset, Job } from "../../lib/types";
import {
  auditTrailSummary,
  buildAuditTrail,
  buildGraphLayers,
  graphSummary,
} from "./graphHelpers";

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

function job(id: string, status: Job["status"]): Job {
  return {
    id,
    project_id: "p1",
    operation_id: "image-gen",
    schema_version: "v1",
    status,
    created_by: "u1",
    created_at: "2026-01-02T00:00:00Z",
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

  it("builds a chronologically sorted audit trail with publish events", () => {
    const published = asset("p", [], {
      type: "video",
      metadata: { publish_receipt: { comment: "approved" } },
      updated_at: "2026-01-03T00:00:00Z",
    });
    const events = buildAuditTrail([asset("a"), published], [job("j", "succeeded")]);
    expect(events.map((event) => event.kind)).toEqual(["publish", "job", "asset", "asset"]);
    expect(events[0]?.detail).toBe("approved");
    expect(auditTrailSummary(events)).toContain("4 events");
  });
});
