import { describe, expect, it } from "vitest";
import type { Asset, AssetType } from "../../lib/types";
import {
  ASSET_TYPES,
  assetPreviewUrl,
  assetStorageLabel,
  assetTypeTone,
  filterAssets,
  formatAssetMeta,
  groupAssetsByShot,
  isPublishAsset,
  matchesAssetSearch,
  shotGroupSummary,
} from "./helpers";

function asset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: "p1",
    type: "image",
    name: id,
    creator_id: "u1",
    storage: { key: `Assets/${id}.png`, size_bytes: 1, content_type: "image/png" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("asset display helpers (search/filter states)", () => {
  it("assigns a badge tone to every asset type", () => {
    for (const type of ASSET_TYPES) {
      expect(assetTypeTone(type as AssetType)).toBeTruthy();
    }
  });

  it("handles missing previews and metadata", () => {
    expect(assetPreviewUrl(asset("a"))).toBeNull();
    expect(assetPreviewUrl(asset("a", { thumbnail_url: "thumb.png" }))).toBe("thumb.png");
    expect(assetPreviewUrl(asset("a", { preview_url: "preview.png" }))).toBe("preview.png");
    expect(formatAssetMeta(asset("a"))).toBe("image");
    expect(isPublishAsset(asset("a"))).toBe(false);
  });

  it("distinguishes Output from Publish storage and formats full metadata", () => {
    const published = asset("a", {
      storage: { key: "Projects/Default/Publish/Ver_002/hero.png", size_bytes: 1, content_type: "image/png" },
      metadata: { sequence: "s01", shot: "s01_c01", lora_slot: "character" },
      version: 2,
    });
    expect(isPublishAsset(published)).toBe(true);
    expect(assetStorageLabel(published)).toBe("Projects/Default/Publish/Ver_002/hero.png");
    expect(formatAssetMeta(published)).toBe(
      "image · s01/s01_c01 · LoRA: character · v2",
    );
  });

  it("matches search across name, type, key and tags, case-insensitively", () => {
    const tagged = asset("a", { tags: ["hero", "approved"] });
    expect(matchesAssetSearch(tagged, "")).toBe(true);
    expect(matchesAssetSearch(tagged, "  ")).toBe(true);
    expect(matchesAssetSearch(tagged, "HERO")).toBe(true);
    expect(matchesAssetSearch(tagged, "image")).toBe(true);
    expect(matchesAssetSearch(tagged, "Assets/a.png")).toBe(true);
    expect(matchesAssetSearch(tagged, "missing")).toBe(false);
  });

  it("returns an empty list when filters match nothing and a full list for all", () => {
    const assets = [asset("hero", { type: "image", tags: ["hero"] }), asset("clip", { type: "video" })];
    expect(filterAssets(assets, "", "all")).toHaveLength(2);
    expect(filterAssets(assets, "hero", "all").map((a) => a.id)).toEqual(["hero"]);
    expect(filterAssets(assets, "", "video").map((a) => a.id)).toEqual(["clip"]);
    expect(filterAssets(assets, "nonexistent", "all")).toEqual([]);
    expect(filterAssets([], "", "all")).toEqual([]);
  });

  it("groups assets by shot metadata with stable ordering and an empty summary", () => {
    expect(groupAssetsByShot([])).toEqual([]);
    expect(shotGroupSummary([])).toBe("No shot-tagged assets");

    const groups = groupAssetsByShot([
      asset("b", { metadata: { sequence: "s01", shot: "s01_c02" } }),
      asset("a", { metadata: { sequence: "s01", shot: "s01_c01" } }),
      asset("untagged"),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["s01_c01", "s01_c02"]);
    expect(shotGroupSummary(groups)).toBe("2 shot groups · 2 assets");
  });
});
