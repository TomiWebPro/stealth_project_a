import { describe, expect, it } from "vitest";
import type { VersionFeed } from "../../lib/types";
import {
  VERSION_FEED_LIMITS,
  buildVersionFeedOptions,
  versionFeedEmptyDescription,
  versionFeedGeneratedAtLabel,
  versionFeedRows,
  versionFeedShortIdLabel,
  versionFeedSummary,
  versionFeedVersionLabel,
} from "./versionFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: VersionFeed = {
  items: [
    {
      asset_id: "asset-bbbb-1111",
      project_id: "proj-aaaa-2222",
      project_name: "A Short Film",
      asset_name: "Shot 01 final",
      asset_type: "video",
      version: 2,
      created_by: "user-dddd-4444",
      created_at: "2026-01-01T00:45:00Z",
    },
    {
      asset_id: "asset-aaaa-3333",
      project_id: "proj-cccc-4444",
      project_name: "Unknown project",
      asset_name: "Character design",
      asset_type: "image",
      version: 1,
      created_by: "user-ffff-7777",
      created_at: "2026-01-01T00:30:00Z",
    },
  ],
  total: 7,
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: VersionFeed = { items: [], total: 0, generated_at: "2026-01-01T00:00:00Z" };

describe("version feed display helpers", () => {
  it("builds hook options with an optional project scope and bounded page size", () => {
    expect(buildVersionFeedOptions(undefined, 25)).toEqual({ limit: 25 });
    expect(buildVersionFeedOptions("proj-aaaa-2222", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      limit: 10,
    });
    expect(VERSION_FEED_LIMITS).toEqual([10, 25, 50]);
  });

  it("formats version labels defensively for malformed version numbers", () => {
    expect(versionFeedVersionLabel(1)).toBe("v1");
    expect(versionFeedVersionLabel(12)).toBe("v12");
    expect(versionFeedVersionLabel(0)).toBe("v?");
    expect(versionFeedVersionLabel(Number.NaN)).toBe("v?");
  });

  it("maps a canonical feed to render-ready rows in wire order", () => {
    const rows = versionFeedRows(populated, NOW);
    expect(rows.map((row) => row.id)).toEqual([
      "asset-bbbb-1111:2",
      "asset-aaaa-3333:1",
    ]);
    expect(rows[0]).toMatchObject({
      assetId: "asset-bbbb-1111",
      assetName: "Shot 01 final",
      assetType: "video",
      typeTone: "accent",
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      version: 2,
      versionLabel: "v2",
      creatorId: "user-dddd-4444",
      creatorLabel: "By user-ddd…",
      relativeTime: "15 minutes ago",
      timestamp: "2026-01-01T00:45:00Z",
    });
    expect(rows[1]).toMatchObject({
      typeTone: "info",
      versionLabel: "v1",
      projectName: "Unknown project",
      relativeTime: "30 minutes ago",
    });
  });

  it("returns no rows for a missing, empty or item-less feed", () => {
    expect(versionFeedRows(undefined, NOW)).toEqual([]);
    expect(versionFeedRows(empty, NOW)).toEqual([]);
    expect(versionFeedRows({ ...populated, items: undefined }, NOW)).toEqual([]);
  });

  it("derives the header summary from visible rows and the untruncated total", () => {
    expect(versionFeedSummary(versionFeedRows(populated, NOW), 7)).toBe(
      "7 versions · latest: Shot 01 final",
    );
    expect(versionFeedSummary(versionFeedRows(populated, NOW))).toBe(
      "2 versions · latest: Shot 01 final",
    );
    expect(versionFeedSummary([], 0)).toBe("No asset versions");
  });

  it("formats the generated-at footer and tolerates missing feeds", () => {
    expect(versionFeedGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(versionFeedGeneratedAtLabel(empty, NOW)).toBe("1 hour ago");
    expect(versionFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("derives scope-aware empty-state copy", () => {
    expect(versionFeedEmptyDescription(false)).toContain("registered and revised");
    expect(versionFeedEmptyDescription(true)).toContain("this project");
  });

  it("derives compact labels for opaque ids with stable fallbacks", () => {
    expect(versionFeedShortIdLabel("abcdef1234567890", "By")).toBe("By abcdef12…");
    expect(versionFeedShortIdLabel("tiny", "By")).toBe("By tiny");
    expect(versionFeedShortIdLabel("  ", "By")).toBe("By");
  });

  it("stays render-safe for a version record with a missing creator", () => {
    const rows = versionFeedRows({
      ...populated,
      items: [
        {
          asset_id: "asset-bbbb-1111",
          project_id: "proj-aaaa-2222",
          project_name: "A Short Film",
          asset_name: "Shot 01 final",
          asset_type: "video",
          version: 2,
          created_by: "",
          created_at: "2026-01-01T00:45:00Z",
        },
      ],
    });
    expect(rows[0]?.creatorLabel).toBe("By");
    expect(rows[0]?.versionLabel).toBe("v2");
  });
});
