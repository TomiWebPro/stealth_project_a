import { describe, expect, it } from "vitest";
import type { AssetFeed, AssetFeedItem } from "../../lib/types";
import {
  ASSET_FEED_LIMITS,
  assetFeedEmptyDescription,
  assetFeedGeneratedAtLabel,
  assetFeedRows,
  assetFeedSummary,
  assetFeedVersionLabel,
  buildAssetFeedOptions,
} from "./assetFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<AssetFeedItem> = {}): AssetFeedItem {
  return {
    asset_id: "asset-aaaa-1111",
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    type: "image",
    name: "Shot 01 keyframe",
    status: "ready",
    version: 2,
    size_bytes: 2 * 1024 * 1024,
    created_at: "2026-01-01T00:45:00Z",
    updated_at: "2026-01-01T00:50:00Z",
    ...overrides,
  };
}

function feed(items: readonly AssetFeedItem[], total = items.length): AssetFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("assetFeedVersionLabel", () => {
  it("formats valid versions and is defensive for bad values", () => {
    expect(assetFeedVersionLabel(1)).toBe("v1");
    expect(assetFeedVersionLabel(7)).toBe("v7");
    expect(assetFeedVersionLabel(0)).toBe("v?");
    expect(assetFeedVersionLabel(-2)).toBe("v?");
    expect(assetFeedVersionLabel(1.5)).toBe("v?");
  });
});

describe("buildAssetFeedOptions", () => {
  it("omits the project scope when unscoped", () => {
    expect(buildAssetFeedOptions(undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the project scope when provided", () => {
    expect(buildAssetFeedOptions("proj-aaaa-2222", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      limit: 10,
    });
  });

  it("offers the canonical page sizes", () => {
    expect(ASSET_FEED_LIMITS).toEqual([10, 25, 50]);
  });
});

describe("assetFeedRows", () => {
  it("returns an empty list for an unset or failed feed", () => {
    expect(assetFeedRows(undefined, NOW)).toEqual([]);
    expect(assetFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" }, NOW)).toEqual([]);
  });

  it("derives render-ready rows while preserving newest-first order", () => {
    const rows = assetFeedRows(
      feed([
        item(),
        item({
          asset_id: "asset-bbbb-2222",
          project_id: "proj-bbbb-3333",
          project_name: "Trailer",
          type: "lora",
          name: "Character LoRA",
          status: "processing",
          version: 1,
          size_bytes: 512,
          created_at: "2026-01-01T00:20:00Z",
        }),
      ]),
      NOW,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.assetId)).toEqual(["asset-aaaa-1111", "asset-bbbb-2222"]);
    expect(rows[0]).toMatchObject({
      id: "asset-aaaa-1111",
      assetId: "asset-aaaa-1111",
      assetName: "Shot 01 keyframe",
      assetType: "image",
      typeLabel: "Image",
      typeTone: "info",
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      status: "ready",
      statusLabel: "Ready",
      statusTone: "success",
      versionLabel: "v2",
      sizeLabel: "2.0 MB",
      timestamp: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      typeLabel: "LoRA",
      statusLabel: "Processing",
      versionLabel: "v1",
      sizeLabel: "512 B",
    });
  });

  it("uses defensive labels for malformed version values", () => {
    const rows = assetFeedRows(feed([item({ version: 0 })]), NOW);
    expect(rows[0]?.versionLabel).toBe("v?");
  });
});

describe("assetFeedSummary", () => {
  it("uses the whole-scope total and the newest asset name", () => {
    const rows = assetFeedRows(feed([item()], 42), NOW);
    expect(assetFeedSummary(rows, 42)).toBe("42 assets · latest: Shot 01 keyframe");
  });

  it("falls back to the visible row count and handles a single row", () => {
    const rows = assetFeedRows(feed([item()]), NOW);
    expect(assetFeedSummary(rows)).toBe("1 asset · latest: Shot 01 keyframe");
  });

  it("reports an empty summary when there are no rows", () => {
    expect(assetFeedSummary([])).toBe("No assets");
  });
});

describe("assetFeedGeneratedAtLabel", () => {
  it("formats a generated-at timestamp relative to now", () => {
    expect(assetFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
  });

  it("returns an empty label when the feed is missing", () => {
    expect(assetFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("assetFeedEmptyDescription", () => {
  it("is scope-aware", () => {
    expect(assetFeedEmptyDescription(true)).toContain("this project");
    expect(assetFeedEmptyDescription(false)).toContain("workspaces");
  });
});
