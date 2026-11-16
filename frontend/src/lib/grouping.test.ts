import { describe, expect, it } from "vitest";

import type { Asset } from "./types";
import { assetSequence, assetShot, groupAssetsBySequence, groupAssetsByShot } from "./grouping";

function makeAsset(id: string, metadata: Record<string, unknown> = {}, createdAt = "2026-01-01T00:00:00.000Z"): Asset {
  return {
    id,
    project_id: "p1",
    type: "image",
    name: id,
    status: "ready",
    creator_id: "00000000-0000-4000-8000-000000000001",
    version: 1,
    tags: [],
    storage: { backend: "s3", bucket: "b", key: `k/${id}`, size_bytes: 1, content_type: "image/png", etag: null, url: null },
    props: { width: null, height: null, duration_ms: null, fps: null, format: null },
    preview_url: null,
    thumbnail_url: null,
    provenance: { operation_id: null, operation_version: null, conversation_id: null, message_id: null, job_id: null, prompt: null, provider_id: null, workflow: null, params: {} },
    parent_asset_ids: [],
    metadata,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("grouping helpers", () => {
  it("reads sequence and shot metadata", () => {
    const a = makeAsset("a", { sequence: "s01", shot: "s01_c01" });
    expect(assetSequence(a)).toBe("s01");
    expect(assetShot(a)).toBe("s01_c01");
    expect(assetSequence(makeAsset("b"))).toBeNull();
    expect(assetShot(makeAsset("b", { shot: "" }))).toBeNull();
  });

  it("groups assets by shot preserving unassigned bucket", () => {
    const assets = [
      makeAsset("a", { sequence: "s01", shot: "s01_c02" }, "2026-01-01T00:02:00.000Z"),
      makeAsset("b", { sequence: "s01", shot: "s01_c01" }, "2026-01-01T00:01:00.000Z"),
      makeAsset("c", {}),
    ];
    const groups = groupAssetsByShot(assets);
    expect(groups.map((g) => g.shot)).toEqual(["s01_c01", "s01_c02", null]);
    expect(groups[0]?.assets.map((a) => a.id)).toEqual(["b"]);
    expect(groups[2]?.assets.map((a) => a.id)).toEqual(["c"]);
  });

  it("groups assets by sequence with nested shot groups", () => {
    const assets = [
      makeAsset("a1", { sequence: "s02", shot: "s02_c01" }),
      makeAsset("b1", { sequence: "s01", shot: "s01_c02" }),
      makeAsset("b2", { sequence: "s01", shot: "s01_c01" }),
      makeAsset("x", {}),
    ];
    const groups = groupAssetsBySequence(assets);
    expect(groups.map((g) => g.sequence)).toEqual(["s01", "s02", null]);
    expect(groups[0]?.shots.map((s) => s.shot)).toEqual(["s01_c01", "s01_c02"]);
    expect(groups[0]?.assets.map((a) => a.id)).toEqual(["b1", "b2"]);
    expect(groups[2]?.shots[0]?.shot).toBeNull();
  });

  it("sorts deterministically by created_at then id", () => {
    const assets = [
      makeAsset("b", { shot: "s01_c01" }, "2026-01-01T00:00:00.000Z"),
      makeAsset("a", { shot: "s01_c01" }, "2026-01-01T00:00:00.000Z"),
    ];
    const [group] = groupAssetsByShot(assets);
    expect(group?.assets.map((a) => a.id)).toEqual(["a", "b"]);
  });
});
