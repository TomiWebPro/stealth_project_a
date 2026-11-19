import { describe, expect, it } from "vitest";
import type { PublishFeed } from "../../lib/types";
import {
  PUBLISH_FEED_LIMITS,
  buildPublishFeedOptions,
  publishFeedEmptyDescription,
  publishFeedGeneratedAtLabel,
  publishFeedRows,
  publishFeedSummary,
  publishFeedVersionLabel,
} from "./publishFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: PublishFeed = {
  items: [
    {
      asset_id: "asset-bbbb-1111",
      asset_name: "Shot 01 final",
      asset_type: "video",
      project_id: "proj-aaaa-2222",
      project_name: "A Short Film",
      version: 2,
      size_bytes: 2 * 1024 * 1024,
      published_at: "2026-01-01T00:45:00Z",
    },
    {
      asset_id: "asset-aaaa-3333",
      asset_name: "Character design",
      asset_type: "image",
      project_id: "proj-cccc-4444",
      project_name: "Unknown project",
      version: 1,
      size_bytes: 512,
      published_at: "2026-01-01T00:30:00Z",
    },
  ],
  total: 7,
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: PublishFeed = { items: [], total: 0, generated_at: "2026-01-01T00:00:00Z" };

describe("publish feed display helpers", () => {
  it("builds hook options with an optional project scope and bounded page size", () => {
    expect(buildPublishFeedOptions(undefined, 25)).toEqual({ limit: 25 });
    expect(buildPublishFeedOptions("proj-aaaa-2222", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      limit: 10,
    });
    expect(PUBLISH_FEED_LIMITS).toEqual([10, 25, 50]);
  });

  it("formats version labels defensively for malformed receipts", () => {
    expect(publishFeedVersionLabel(1)).toBe("v1");
    expect(publishFeedVersionLabel(12)).toBe("v12");
    expect(publishFeedVersionLabel(0)).toBe("v?");
    expect(publishFeedVersionLabel(Number.NaN)).toBe("v?");
  });

  it("maps a canonical feed to render-ready rows in wire order", () => {
    const rows = publishFeedRows(populated, NOW);
    expect(rows.map((row) => row.assetId)).toEqual(["asset-bbbb-1111", "asset-aaaa-3333"]);
    expect(rows[0]).toMatchObject({
      id: "asset-bbbb-1111",
      assetName: "Shot 01 final",
      assetType: "video",
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      versionLabel: "v2",
      sizeLabel: "2.0 MB",
      relativeTime: "15 minutes ago",
      timestamp: "2026-01-01T00:45:00Z",
    });
    expect(rows[1]).toMatchObject({
      typeTone: "info",
      versionLabel: "v1",
      sizeLabel: "512 B",
      relativeTime: "30 minutes ago",
    });
  });

  it("returns no rows for a missing or empty feed", () => {
    expect(publishFeedRows(undefined, NOW)).toEqual([]);
    expect(publishFeedRows(empty, NOW)).toEqual([]);
  });

  it("derives the header summary from visible rows and the untruncated total", () => {
    expect(publishFeedSummary(publishFeedRows(populated, NOW), 7)).toBe(
      "7 published · latest: Shot 01 final",
    );
    expect(publishFeedSummary(publishFeedRows(populated, NOW))).toBe(
      "2 published · latest: Shot 01 final",
    );
    expect(publishFeedSummary([], 0)).toBe("No published deliverables");
  });

  it("formats the generated-at footer and tolerates missing feeds", () => {
    expect(publishFeedGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(publishFeedGeneratedAtLabel(empty, NOW)).toBe("1 hour ago");
    expect(publishFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("derives scope-aware empty-state copy", () => {
    expect(publishFeedEmptyDescription(false)).toContain("Publish folder");
    expect(publishFeedEmptyDescription(true)).toContain("this project");
  });
});
