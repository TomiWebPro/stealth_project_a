import { describe, expect, it } from "vitest";
import type { LineageFeed, RelationshipType } from "../../lib/types";
import {
  LINEAGE_FEED_LIMITS,
  buildLineageFeedOptions,
  lineageFeedEmptyDescription,
  lineageFeedGeneratedAtLabel,
  lineageFeedRows,
  lineageFeedSummary,
  lineageTargetKnown,
} from "./lineageFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: LineageFeed = {
  items: [
    {
      id: "rel-bbbb-1111",
      from_asset_id: "asset-source-1111",
      to_asset_id: "asset-target-2222",
      from_asset_name: "Character design",
      to_asset_name: "Training dataset",
      project_id: "proj-aaaa-2222",
      project_name: "A Short Film",
      type: "derived_from",
      created_at: "2026-01-01T00:45:00Z",
    },
    {
      id: "rel-aaaa-3333",
      from_asset_id: "asset-source-4444",
      to_asset_id: "asset-gone-5555",
      from_asset_name: "Shot 01 frame",
      to_asset_name: "Unknown asset",
      project_id: "proj-cccc-4444",
      project_name: "Unknown project",
      type: "uses_input",
      created_at: "2026-01-01T00:30:00Z",
    },
  ],
  total: 9,
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: LineageFeed = { items: [], total: 0, generated_at: "2026-01-01T00:00:00Z" };

describe("lineage feed display helpers", () => {
  it("builds hook options with an optional project scope and bounded page size", () => {
    expect(buildLineageFeedOptions(undefined, 25)).toEqual({ limit: 25 });
    expect(buildLineageFeedOptions("proj-aaaa-2222", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      limit: 10,
    });
    expect(LINEAGE_FEED_LIMITS).toEqual([10, 25, 50]);
  });

  it("detects only live relationship targets as linkable", () => {
    expect(lineageTargetKnown("Training dataset")).toBe(true);
    expect(lineageTargetKnown("Unknown asset")).toBe(false);
    expect(lineageTargetKnown("  ")).toBe(false);
    expect(lineageTargetKnown("")).toBe(false);
  });

  it("maps a canonical feed to render-ready rows in wire order", () => {
    const rows = lineageFeedRows(populated, NOW);
    expect(rows.map((row) => row.id)).toEqual(["rel-bbbb-1111", "rel-aaaa-3333"]);
    expect(rows[0]).toMatchObject({
      fromAssetId: "asset-source-1111",
      fromAssetName: "Character design",
      toAssetId: "asset-target-2222",
      toAssetName: "Training dataset",
      hasTarget: true,
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      type: "derived_from",
      typeLabel: "Derived from",
      typeTone: "info",
      relativeTime: "15 minutes ago",
      timestamp: "2026-01-01T00:45:00Z",
    });
    expect(rows[1]).toMatchObject({
      type: "uses_input",
      typeLabel: "Uses input",
      typeTone: "warning",
      hasTarget: false,
      projectName: "Unknown project",
      relativeTime: "30 minutes ago",
    });
  });

  it("returns no rows for a missing, empty or item-less feed", () => {
    expect(lineageFeedRows(undefined, NOW)).toEqual([]);
    expect(lineageFeedRows(empty, NOW)).toEqual([]);
    expect(lineageFeedRows({ ...populated, items: undefined }, NOW)).toEqual([]);
  });

  it("derives the header summary from visible rows and the untruncated total", () => {
    expect(lineageFeedSummary(lineageFeedRows(populated, NOW), 9)).toBe(
      "9 relationships · latest: Character design → Training dataset",
    );
    expect(lineageFeedSummary(lineageFeedRows(populated, NOW))).toBe(
      "2 relationships · latest: Character design → Training dataset",
    );
    expect(lineageFeedSummary([], 0)).toBe("No relationships");
  });

  it("formats the generated-at footer and tolerates missing feeds", () => {
    expect(lineageFeedGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(lineageFeedGeneratedAtLabel(empty, NOW)).toBe("1 hour ago");
    expect(lineageFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("derives scope-aware empty-state copy", () => {
    expect(lineageFeedEmptyDescription(false)).toContain("derived and linked");
    expect(lineageFeedEmptyDescription(true)).toContain("this project");
  });

  it("stays render-safe for a relationship with missing display names and an odd type", () => {
    const rows = lineageFeedRows(
      {
        ...populated,
        items: [
          {
            id: "rel-odd-9999",
            from_asset_id: "asset-source-1111",
            to_asset_id: "asset-target-2222",
            from_asset_name: "",
            to_asset_name: "",
            project_id: "proj-aaaa-2222",
            project_name: "",
            type: "brand_new_kind" as RelationshipType,
            created_at: "2026-01-01T00:45:00Z",
          },
        ],
      },
      NOW,
    );
    expect(rows[0]).toMatchObject({
      fromAssetName: "Unknown asset",
      toAssetName: "Unknown asset",
      hasTarget: false,
      projectName: "Unknown project",
      typeLabel: "Brand New Kind",
      typeTone: "neutral",
    });
  });
});
