import { describe, expect, it } from "vitest";
import type { Asset } from "../../lib/types";
import { buildVersionChains, publishReceiptSummary, versionLabel } from "./versionHelpers";

function asset(id: string, key: string, metadata: Asset["metadata"] = {}): Asset {
  return {
    id,
    project_id: "p1",
    type: "image",
    name: id,
    creator_id: "u1",
    storage: { key, size_bytes: 1, content_type: "image/png" },
    metadata,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("version helpers", () => {
  it("returns no chains for an empty or unversioned asset set", () => {
    expect(buildVersionChains([])).toEqual([]);
    expect(buildVersionChains([asset("a", "assets/a.png")])).toEqual([]);
  });

  it("falls back to numeric or unversioned labels", () => {
    expect(versionLabel(asset("a", "p/Ver_002/Output/a.png"))).toBe("Ver_002");
    expect(versionLabel({ ...asset("a", "assets/a.png"), version: 3 })).toBe("v3");
    expect(versionLabel(asset("a", "assets/a.png"))).toBe("Unversioned");
  });

  it("groups Output/Publish into a single ordered chain with receipts", () => {
    const receipt = {
      comment: "approved",
      publisher: "u1",
      sidecar: "Publish/a.sidecar.json",
    };
    const chains = buildVersionChains([
      asset("v2", "p/Ver_002/Publish/hero.png", { publish_receipt: receipt }),
      asset("v1", "p/Ver_001/Output/hero.png"),
    ]);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.entries.map((entry) => entry.versionTag)).toEqual(["Ver_001", "Ver_002"]);
    expect(chains[0]?.entries.map((entry) => entry.kind)).toEqual(["output", "publish"]);
    expect(publishReceiptSummary(chains[0]?.entries[1]?.asset as Asset)).toBe(
      "Published by u1: approved",
    );
  });
});
