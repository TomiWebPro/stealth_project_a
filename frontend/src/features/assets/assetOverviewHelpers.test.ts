import { describe, expect, it } from "vitest";
import type { AssetOverview, AssetVersion } from "../../lib/types";
import {
  assetOverviewActorLabel,
  assetOverviewCount,
  assetOverviewCountRows,
  assetOverviewGeneratedAtLabel,
  assetOverviewIdentity,
  assetOverviewRecentVersions,
  assetOverviewRelativeLabel,
  assetOverviewSummaryLabel,
  hasAssetOverviewData,
} from "./assetOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function version(overrides: Partial<AssetVersion> = {}): AssetVersion {
  return {
    asset_id: "asset-aaaa-1111",
    version: 2,
    storage: { key: "Projects/Default/Assets/Char/shot01.png", size_bytes: 1536, content_type: "image/png" },
    created_at: "2026-01-01T00:40:00Z",
    created_by: "user-aaaa-3333",
    ...overrides,
  };
}

function overview(overrides: Partial<AssetOverview> = {}): AssetOverview {
  return {
    asset_id: "asset-aaaa-1111",
    asset_name: "Shot 01 keyframe",
    asset_type: "image",
    status: "ready",
    version: 2,
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    created_at: "2026-01-01T00:00:00Z",
    published: true,
    counts: {
      versions: 3,
      upstream: 1,
      downstream: 2,
      comments: 4,
      tags: 5,
    },
    recent_versions: [version()],
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function emptyOverview(): AssetOverview {
  return overview({
    published: false,
    counts: { versions: 0, upstream: 0, downstream: 0, comments: 0, tags: 0 },
    recent_versions: [],
  });
}

describe("assetOverview formatters", () => {
  it("formats relative labels defensively", () => {
    expect(assetOverviewRelativeLabel(null)).toBe("");
    expect(assetOverviewRelativeLabel(undefined)).toBe("");
    expect(assetOverviewRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(assetOverviewRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("formats the generated-at footer label", () => {
    expect(assetOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
    expect(assetOverviewGeneratedAtLabel(undefined)).toBe("");
  });

  it("zero-fills a single missing count", () => {
    expect(assetOverviewCount(overview(), "versions")).toBe(3);
    expect(assetOverviewCount(undefined, "comments")).toBe(0);
    expect(assetOverviewCount(emptyOverview(), "tags")).toBe(0);
    expect(assetOverviewCount(overview({ counts: { ...overview().counts, tags: -1 } }), "tags")).toBe(0);
  });

  it("abbreviates long actor ids and keeps short ones", () => {
    expect(assetOverviewActorLabel("user-aaaa-3333")).toBe("user-aaa…");
    expect(assetOverviewActorLabel("abc")).toBe("abc");
    expect(assetOverviewActorLabel(null)).toBe("—");
  });
});

describe("assetOverviewCountRows", () => {
  it("derives all five counters in a stable order", () => {
    const rows = assetOverviewCountRows(overview());
    expect(rows.map((row) => row.key)).toEqual(["versions", "upstream", "downstream", "comments", "tags"]);
    expect(rows.map((row) => row.value)).toEqual(["3", "1", "2", "4", "5"]);
    expect(rows.every((row) => row.label && row.hint)).toBe(true);
  });

  it("zero-fills every counter when the snapshot is absent", () => {
    expect(assetOverviewCountRows(undefined).map((row) => row.value)).toEqual(["0", "0", "0", "0", "0"]);
  });
});

describe("assetOverviewIdentity", () => {
  it("derives badges and recency labels for a populated snapshot", () => {
    expect(assetOverviewIdentity(overview(), NOW)).toEqual({
      name: "Shot 01 keyframe",
      typeLabel: "Image",
      typeTone: "info",
      statusLabel: "Ready",
      statusTone: "success",
      versionLabel: "v2",
      publishedLabel: "Published",
      publishedTone: "success",
      projectLabel: "A Short Film",
      createdLabel: "1 hour ago",
      generatedLabel: "30 seconds ago",
    });
  });

  it("uses neutral badges for an unpublished snapshot", () => {
    const identity = assetOverviewIdentity(overview({ published: false }), NOW);
    expect(identity.publishedLabel).toBe("Not published");
    expect(identity.publishedTone).toBe("neutral");
  });

  it("is defensive for a missing snapshot", () => {
    expect(assetOverviewIdentity(undefined, NOW)).toEqual({
      name: "—",
      typeLabel: "—",
      typeTone: "neutral",
      statusLabel: "—",
      statusTone: "neutral",
      versionLabel: "—",
      publishedLabel: "Not published",
      publishedTone: "neutral",
      projectLabel: "",
      createdLabel: "",
      generatedLabel: "",
    });
  });
});

describe("assetOverviewRecentVersions", () => {
  it("projects recent versions into render-safe rows", () => {
    const rows = assetOverviewRecentVersions(overview(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "asset-aaaa-1111:2",
      versionLabel: "v2",
      bytesLabel: "1.5 KB",
      creatorLabel: "user-aaa…",
      relativeTime: "20 minutes ago",
      timestamp: "2026-01-01T00:40:00Z",
    });
  });

  it("returns no rows when the snapshot or recents are absent", () => {
    expect(assetOverviewRecentVersions(undefined)).toEqual([]);
    expect(assetOverviewRecentVersions(overview({ recent_versions: undefined }))).toEqual([]);
  });
});

describe("hasAssetOverviewData", () => {
  it("is false for a missing or entirely empty snapshot", () => {
    expect(hasAssetOverviewData(undefined)).toBe(false);
    expect(hasAssetOverviewData(emptyOverview())).toBe(false);
  });

  it("is true when a count, a published flag or a recent version is present", () => {
    expect(hasAssetOverviewData(overview())).toBe(true);
    expect(hasAssetOverviewData(overview({
      counts: emptyOverview().counts,
      recent_versions: [],
    }))).toBe(true); // published
    expect(hasAssetOverviewData(overview({
      published: false,
      counts: emptyOverview().counts,
      recent_versions: [version()],
    }))).toBe(true);
  });
});

describe("assetOverviewSummaryLabel", () => {
  it("summarizes the headline cross-domain counts", () => {
    expect(assetOverviewSummaryLabel(overview())).toBe("3 versions · 3 lineage links · 4 comments · 5 tags");
    expect(assetOverviewSummaryLabel(undefined)).toBe("");
  });
});
