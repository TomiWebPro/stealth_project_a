import { describe, expect, it } from "vitest";
import type { PipelineFeed, PipelineFeedItem } from "../../lib/types";
import {
  buildPipelineFeedOptions,
  pipelineFeedCountsLabel,
  pipelineFeedEmptyDescription,
  pipelineFeedGeneratedAtLabel,
  pipelineFeedKindChipLabel,
  pipelineFeedKindTone,
  pipelineFeedProjectName,
  pipelineFeedRows,
  pipelineFeedSummary,
  PIPELINE_FEED_KIND_FILTERS,
  PIPELINE_FEED_LIMITS,
  shortPipelineChainId,
} from "./pipelineFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<PipelineFeedItem> = {}): PipelineFeedItem {
  return {
    chain_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "Short Film",
    kind: "training",
    job_count: 4,
    asset_count: 2,
    created_by: "22222222-2222-4222-8222-222222222222",
    created_at: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function feed(items: readonly PipelineFeedItem[], total = items.length): PipelineFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("buildPipelineFeedOptions", () => {
  it("omits both filters when unscoped", () => {
    expect(buildPipelineFeedOptions(undefined, undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the project and kind filters when provided", () => {
    expect(buildPipelineFeedOptions("11111111-1111-4111-8111-111111111111", "shot", 10)).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
      kind: "shot",
      limit: 10,
    });
  });

  it("offers the canonical page sizes and kind chips", () => {
    expect(PIPELINE_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(PIPELINE_FEED_KIND_FILTERS).toEqual([undefined, "training", "shot", "splat"]);
  });
});

describe("pipeline feed chip labels and tones", () => {
  it("labels the unfiltered chip and canonical kinds", () => {
    expect(pipelineFeedKindChipLabel(undefined)).toBe("All");
    expect(pipelineFeedKindChipLabel("training")).toBe("Training");
    expect(pipelineFeedKindChipLabel("shot")).toBe("Shot");
    expect(pipelineFeedKindChipLabel("splat")).toBe("Splat");
  });

  it("maps canonical kinds to the shared badge tones", () => {
    expect(pipelineFeedKindTone("training")).toBe("warning");
    expect(pipelineFeedKindTone("shot")).toBe("info");
    expect(pipelineFeedKindTone("splat")).toBe("success");
  });
});

describe("pipelineFeedCountsLabel / fallbacks", () => {
  it("pluralizes job/asset counts and defaults malformed values to zero", () => {
    expect(pipelineFeedCountsLabel(1, 1)).toBe("1 job · 1 asset");
    expect(pipelineFeedCountsLabel(4, 2)).toBe("4 jobs · 2 assets");
    expect(pipelineFeedCountsLabel(undefined, -3)).toBe("0 jobs · 0 assets");
    expect(pipelineFeedCountsLabel(Number.NaN, 3)).toBe("0 jobs · 3 assets");
  });

  it("shortens chain ids and falls back for missing project names", () => {
    expect(shortPipelineChainId("abcdefgh-1111-4111-8111-abcdefghijkl")).toBe("abcdefgh…");
    expect(shortPipelineChainId("short")).toBe("short");
    expect(shortPipelineChainId(undefined)).toBe("—");
    expect(pipelineFeedProjectName("Short Film")).toBe("Short Film");
    expect(pipelineFeedProjectName("  ")).toBe("Unknown project");
    expect(pipelineFeedProjectName(undefined)).toBe("Unknown project");
  });
});

describe("pipelineFeedRows", () => {
  it("returns an empty list for an unset, failed or item-less feed", () => {
    expect(pipelineFeedRows(undefined, NOW)).toEqual([]);
    expect(pipelineFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" }, NOW)).toEqual([]);
    expect(pipelineFeedRows(feed([]), NOW)).toEqual([]);
  });

  it("derives render-ready rows while preserving newest-first wire order", () => {
    const rows = pipelineFeedRows(
      feed([
        item(),
        item({
          chain_id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
          project_id: "33333333-3333-4333-8333-333333333333",
          project_name: "",
          kind: "splat",
          job_count: 1,
          asset_count: 3,
          created_at: "2026-01-01T00:20:00Z",
        }),
      ]),
      NOW,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([
      "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
    ]);
    expect(rows[0]).toMatchObject({
      shortChainId: "aaaaaaaa…",
      projectId: "11111111-1111-4111-8111-111111111111",
      projectName: "Short Film",
      kind: "training",
      kindLabel: "Training",
      kindTone: "warning",
      jobCount: 4,
      assetCount: 2,
      countsLabel: "4 jobs · 2 assets",
      timestamp: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      projectName: "Unknown project",
      kind: "splat",
      kindLabel: "Splat",
      kindTone: "success",
      countsLabel: "1 job · 3 assets",
      relativeTime: "40 minutes ago",
    });
  });
});

describe("pipelineFeedSummary", () => {
  it("describes an empty feed", () => {
    expect(pipelineFeedSummary([], 0)).toBe("No pipeline chains");
  });

  it("uses the untruncated total and the newest chain", () => {
    const rows = pipelineFeedRows(feed([item()]), NOW);
    expect(pipelineFeedSummary(rows, 99)).toBe("99 chains · latest: Training in Short Film");
    expect(pipelineFeedSummary(rows)).toBe("1 chain · latest: Training in Short Film");
  });
});

describe("pipelineFeedGeneratedAtLabel", () => {
  it("is empty when absent and relative when present", () => {
    expect(pipelineFeedGeneratedAtLabel(undefined, NOW)).toBe("");
    expect(pipelineFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
  });
});

describe("pipelineFeedEmptyDescription", () => {
  it("is scope-aware", () => {
    expect(pipelineFeedEmptyDescription(true)).toContain("filters");
    expect(pipelineFeedEmptyDescription(false)).toContain("Training, shot and splat");
  });
});
