import { describe, expect, it } from "vitest";
import type { LineageOverview } from "../../lib/types";
import type { LineageFeedRow } from "./lineageFeedHelpers";
import {
  LINEAGE_OVERVIEW_FEED_LIMITS,
  LINEAGE_OVERVIEW_RECENT_LIMIT,
  buildLineageOverviewFeedOptions,
  buildLineageOverviewOptions,
  hasLineageOverviewData,
  lineageOverviewActiveOption,
  lineageOverviewCount,
  lineageOverviewCountRows,
  lineageOverviewEmptyDescription,
  lineageOverviewGeneratedAtLabel,
  lineageOverviewIdentity,
  lineageOverviewPickerOptions,
  lineageOverviewRecentRows,
  lineageOverviewRelativeLabel,
  lineageOverviewSummaryLabel,
  lineageOverviewTargetKnown,
} from "./lineageOverviewHelpers";

const NOW = Date.parse("2026-01-01T12:00:00Z");

const populated: LineageOverview = {
  id: "11111111-2222-4333-8444-555555555555",
  from_asset_id: "asset-source-0001",
  to_asset_id: "asset-target-0002",
  from_asset_name: "Hero character",
  to_asset_name: "Hero LoRA",
  from_asset_type: "image",
  to_asset_type: "lora",
  project_id: "proj-aaaa-1111",
  project_name: "A Short Film",
  type: "derived_from",
  created_at: "2026-01-01T09:00:00Z",
  counts: {
    source_upstream: 2,
    source_downstream: 7,
    source_types: 3,
    project_relationships: 12,
  },
  recent_relationships: [
    {
      id: "aaaaaaaa-2222-4333-8444-555555555555",
      from_asset_id: "asset-source-0001",
      to_asset_id: "asset-target-0002",
      from_asset_name: "Hero character",
      to_asset_name: "Hero LoRA",
      project_id: "proj-aaaa-1111",
      project_name: "A Short Film",
      type: "derived_from",
      created_at: "2026-01-01T10:00:00Z",
    },
    {
      id: "bbbbbbbb-2222-4333-8444-555555555555",
      from_asset_id: "asset-source-0001",
      to_asset_id: "asset-target-0003",
      from_asset_name: "Hero character",
      to_asset_name: "Unknown asset",
      project_id: "proj-aaaa-1111",
      project_name: "A Short Film",
      type: "uses_input",
      created_at: "2026-01-01T08:00:00Z",
    },
  ],
  generated_at: "2026-01-01T11:59:00Z",
};

const rows: readonly LineageFeedRow[] = [
  {
    id: "11111111-2222-4333-8444-555555555555",
    fromAssetId: "asset-source-0001",
    fromAssetName: "Hero character",
    toAssetId: "asset-target-0002",
    toAssetName: "Hero LoRA",
    hasTarget: true,
    projectId: "proj-aaaa-1111",
    projectName: "A Short Film",
    type: "derived_from",
    typeLabel: "Derived from",
    typeTone: "info",
    timestamp: "2026-01-01T09:00:00Z",
    relativeTime: "3 hours ago",
  },
];

describe("lineage overview display helpers", () => {
  it("returns zero-filled counts for missing, negative or malformed snapshots", () => {
    expect(lineageOverviewCount(undefined)).toBe(0);
    expect(lineageOverviewCount(null, "source_downstream")).toBe(0);
    expect(
      lineageOverviewCount(
        { ...populated, counts: { ...populated.counts, source_types: Number.NaN } },
        "source_types",
      ),
    ).toBe(0);
    expect(
      lineageOverviewCount({ ...populated, counts: { ...populated.counts, project_relationships: -1 } }, "project_relationships"),
    ).toBe(0);
    expect(lineageOverviewCount(populated, "source_downstream")).toBe(7);
  });

  it("emits all four counters in a stable zero-filled order", () => {
    const defaultRows = lineageOverviewCountRows(undefined);
    expect(defaultRows.map((row) => row.key)).toEqual([
      "source_upstream",
      "source_downstream",
      "source_types",
      "project_relationships",
    ]);
    expect(defaultRows.every((row) => row.value === "0")).toBe(true);
    expect(lineageOverviewCountRows(populated).map((row) => row.value)).toEqual([
      "2",
      "7",
      "3",
      "12",
    ]);
  });

  it("derives relative labels and tolerates absent timestamps", () => {
    expect(lineageOverviewRelativeLabel("2026-01-01T09:00:00Z", NOW)).toBe("3 hours ago");
    expect(lineageOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(lineageOverviewGeneratedAtLabel(populated, NOW)).toBe("1 minute ago");
    expect(lineageOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("derives identity, badges and context for the snapshot header", () => {
    const identity = lineageOverviewIdentity(populated, NOW);
    expect(identity.typeLabel).toBe("Derived from");
    expect(identity.typeTone).toBe("info");
    expect(identity.fromName).toBe("Hero character");
    expect(identity.toName).toBe("Hero LoRA");
    expect(identity.fromTypeLabel).toBe("Image");
    expect(identity.toTypeLabel).toBe("LoRA");
    expect(identity.hasTarget).toBe(true);
    expect(identity.projectLabel).toBe("A Short Film");
    expect(identity.shortId).toBe("11111111…");
    expect(identity.createdLabel).toBe("3 hours ago");
  });

  it("falls back to stable sentinels for a missing target and empty snapshot", () => {
    const missingTarget = lineageOverviewIdentity(
      { ...populated, to_asset_name: "Unknown asset", to_asset_type: null, project_name: "" },
      NOW,
    );
    expect(missingTarget.toName).toBe("Unknown asset");
    expect(missingTarget.hasTarget).toBe(false);
    expect(missingTarget.toTypeLabel).toBe("");
    expect(missingTarget.projectLabel).toBe("Unknown project");

    const empty = lineageOverviewIdentity(undefined, NOW);
    expect(empty.typeLabel).toBe("Relationship");
    expect(empty.typeTone).toBe("neutral");
    expect(empty.fromName).toBe("Unknown asset");
    expect(empty.hasTarget).toBe(false);
    expect(empty.shortId).toBe("");

    expect(lineageOverviewTargetKnown(populated)).toBe(true);
    expect(lineageOverviewTargetKnown({ ...populated, to_asset_name: "Unknown asset" })).toBe(false);
    expect(lineageOverviewTargetKnown(undefined)).toBe(false);
  });

  it("projects sibling links with the canonical feed row shape", () => {
    const siblings = lineageOverviewRecentRows(populated, NOW);
    expect(siblings).toHaveLength(2);
    expect(siblings[0]).toMatchObject({
      id: "aaaaaaaa-2222-4333-8444-555555555555",
      fromAssetName: "Hero character",
      toAssetName: "Hero LoRA",
      typeLabel: "Derived from",
      hasTarget: true,
      relativeTime: "2 hours ago",
    });
    expect(siblings[1]).toMatchObject({
      hasTarget: false,
      toAssetName: "Unknown asset",
      typeLabel: "Uses input",
    });
    expect(lineageOverviewRecentRows(undefined, NOW)).toEqual([]);
  });

  it("detects data presence and builds one-line summaries", () => {
    expect(hasLineageOverviewData(undefined)).toBe(false);
    expect(
      hasLineageOverviewData({
        ...populated,
        counts: { source_upstream: 0, source_downstream: 0, source_types: 0, project_relationships: 0 },
        recent_relationships: [],
      }),
    ).toBe(false);
    expect(hasLineageOverviewData(populated)).toBe(true);
    expect(lineageOverviewSummaryLabel(populated)).toBe("2 upstream · 7 downstream · 12 in project");
    expect(lineageOverviewSummaryLabel(undefined)).toBe("");
  });

  it("derives picker options and resolves the active option", () => {
    const options = lineageOverviewPickerOptions(rows);
    expect(options).toEqual([
      {
        value: "11111111-2222-4333-8444-555555555555",
        label: "Derived from: Hero character → Hero LoRA · A Short Film",
        relationshipId: "11111111-2222-4333-8444-555555555555",
      },
    ]);
    expect(lineageOverviewActiveOption(options, "missing")?.relationshipId).toBe(
      "11111111-2222-4333-8444-555555555555",
    );
    expect(lineageOverviewActiveOption(options, "")?.relationshipId).toBe(
      "11111111-2222-4333-8444-555555555555",
    );
    expect(lineageOverviewActiveOption([], "")).toBeUndefined();
  });

  it("builds hook options and scope-aware empty copy", () => {
    expect(buildLineageOverviewOptions()).toEqual({ recentLimit: LINEAGE_OVERVIEW_RECENT_LIMIT });
    expect(buildLineageOverviewOptions(10)).toEqual({ recentLimit: 10 });
    expect(buildLineageOverviewFeedOptions("proj-1", 25)).toEqual({ projectId: "proj-1", limit: 25 });
    expect(buildLineageOverviewFeedOptions(undefined, 10)).toEqual({ limit: 10 });
    expect(LINEAGE_OVERVIEW_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(lineageOverviewEmptyDescription(true)).toContain("this project");
    expect(lineageOverviewEmptyDescription(false)).toContain("assets are derived");
  });
});
