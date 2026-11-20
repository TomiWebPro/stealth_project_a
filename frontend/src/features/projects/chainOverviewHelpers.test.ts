import { describe, expect, it } from "vitest";
import type { ChainOverview, PipelineFeed, PipelineFeedItem } from "../../lib/types";
import {
  buildChainPickerFeedOptions,
  chainAssetRows,
  chainJobRows,
  chainOptionLabel,
  chainOverviewCounts,
  chainOverviewGeneratedAtLabel,
  chainOverviewIdentity,
  chainOverviewOptions,
  chainOverviewRelativeLabel,
  chainOverviewStatRows,
  chainOverviewSummaryLabel,
  CHAIN_OVERVIEW_PICKER_LIMIT,
  CHAIN_OVERVIEW_RECENT_LIMITS,
  chainPickerOptions,
  hasChainOverviewData,
} from "./chainOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function overview(overrides: Partial<ChainOverview> = {}): ChainOverview {
  return {
    chain_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "Short Film",
    kind: "training",
    created_by: "22222222-2222-4222-8222-222222222222",
    created_at: "2026-01-01T00:45:00Z",
    counts: { jobs: 3, assets: 2 },
    recent_jobs: [
      {
        job_id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
        operation_id: "lora-train",
        status: "running",
        created_at: "2026-01-01T00:40:00Z",
      },
      {
        job_id: "cccccccc-3333-4333-8333-cccccccccccc",
        operation_id: "dataset-prep",
        status: "succeeded",
        created_at: "2026-01-01T00:30:00Z",
      },
    ],
    recent_assets: [
      {
        asset_id: "dddddddd-4444-4444-8444-dddddddddddd",
        name: "Character LoRA",
        asset_type: "lora",
        created_at: "2026-01-01T00:35:00Z",
      },
    ],
    generated_at: "2026-01-01T00:59:00Z",
    ...overrides,
  };
}

function feedItem(overrides: Partial<PipelineFeedItem> = {}): PipelineFeedItem {
  return {
    chain_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "Short Film",
    kind: "training",
    job_count: 3,
    asset_count: 2,
    created_by: "22222222-2222-4222-8222-222222222222",
    created_at: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function feed(items: readonly PipelineFeedItem[]): PipelineFeed {
  return { items: [...items], total: items.length, generated_at: "2026-01-01T00:59:00Z" };
}

describe("chain overview query option helpers", () => {
  it("omits the recent limit when unset and includes it when provided", () => {
    expect(chainOverviewOptions()).toEqual({});
    expect(chainOverviewOptions(10)).toEqual({ recentLimit: 10 });
  });

  it("builds project-scoped picker feed options with a bounded page size", () => {
    expect(buildChainPickerFeedOptions()).toEqual({ limit: CHAIN_OVERVIEW_PICKER_LIMIT });
    expect(buildChainPickerFeedOptions("11111111-1111-4111-8111-111111111111")).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
      limit: CHAIN_OVERVIEW_PICKER_LIMIT,
    });
    expect(CHAIN_OVERVIEW_RECENT_LIMITS).toEqual([5, 10, 25]);
  });
});

describe("chain picker options", () => {
  it("labels a chain with its kind, short id and joined project name", () => {
    expect(chainOptionLabel(feedItem())).toBe(
      "Training chain · aaaaaaaa… · Short Film",
    );
    expect(chainOptionLabel(feedItem({ project_name: "", kind: "splat" }))).toBe(
      "Splat chain · aaaaaaaa… · Unknown project",
    );
  });

  it("maps the feed into stable options and tolerates missing feeds", () => {
    expect(chainPickerOptions()).toEqual([]);
    expect(chainPickerOptions(feed([]))).toEqual([]);
    expect(
      chainPickerOptions(feed([feedItem(), feedItem({ chain_id: "eeeeeeee-5555-4555-8555-eeeeeeeeeeee" })])),
    ).toEqual([
      { value: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", label: "Training chain · aaaaaaaa… · Short Film" },
      { value: "eeeeeeee-5555-4555-8555-eeeeeeeeeeee", label: "Training chain · eeeeeeee… · Short Film" },
    ]);
  });
});

describe("chainOverviewRelativeLabel / generated at", () => {
  it("is empty when absent and relative when present", () => {
    expect(chainOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(chainOverviewRelativeLabel("", NOW)).toBe("");
    expect(chainOverviewRelativeLabel("2026-01-01T00:45:00Z", NOW)).toBe("15 minutes ago");
    expect(chainOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
    expect(chainOverviewGeneratedAtLabel(overview(), NOW)).toBe("1 minute ago");
  });
});

describe("chainOverviewCounts", () => {
  it("zero-fills and truncates malformed counts", () => {
    expect(chainOverviewCounts()).toEqual({ jobs: 0, assets: 0 });
    expect(chainOverviewCounts(overview())).toEqual({ jobs: 3, assets: 2 });
    expect(chainOverviewCounts(overview({ counts: { jobs: -1, assets: 2.9 } }))).toEqual({
      jobs: 0,
      assets: 2,
    });
  });
});

describe("chainOverviewIdentity", () => {
  it("derives kind/chain/project labels and tones", () => {
    expect(chainOverviewIdentity(overview(), NOW)).toMatchObject({
      kindLabel: "Training",
      kindTone: "warning",
      chainIdLabel: "aaaaaaaa…",
      projectName: "Short Film",
      projectId: "11111111-1111-4111-8111-111111111111",
      createdByLabel: "22222222…",
      createdLabel: "15 minutes ago",
    });
  });

  it("falls back for a missing snapshot", () => {
    expect(chainOverviewIdentity(undefined, NOW)).toMatchObject({
      kindLabel: "Unknown",
      kindTone: "neutral",
      chainIdLabel: "—",
      projectName: "Unknown project",
      projectId: "",
      createdByLabel: "—",
      createdLabel: "",
    });
  });
});

describe("chainOverviewStatRows", () => {
  it("renders whole-chain totals alongside bounded recent counts", () => {
    const rows = chainOverviewStatRows(overview());
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => [row.key, row.value])).toEqual([
      ["jobs", "3"],
      ["assets", "2"],
      ["recent-jobs", "2"],
      ["recent-assets", "1"],
    ]);
    expect(chainOverviewStatRows().every((row) => row.value === "0")).toBe(true);
  });
});

describe("chainJobRows", () => {
  it("projects recent jobs while preserving newest-first wire order", () => {
    const rows = chainJobRows(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([
      "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
      "cccccccc-3333-4333-8333-cccccccccccc",
    ]);
    expect(rows[0]).toMatchObject({
      shortJobId: "bbbbbbbb…",
      operationLabel: "Lora Train",
      statusLabel: "Running",
      statusTone: "info",
      timestamp: "2026-01-01T00:40:00Z",
      relativeTime: "20 minutes ago",
    });
    expect(rows[1]).toMatchObject({ statusLabel: "Succeeded", statusTone: "success" });
  });

  it("is empty for a missing snapshot or no recent jobs", () => {
    expect(chainJobRows()).toEqual([]);
    expect(chainJobRows(overview({ recent_jobs: [] }))).toEqual([]);
  });
});

describe("chainAssetRows", () => {
  it("projects recent assets with type labels and name fallbacks", () => {
    const rows = chainAssetRows(overview(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "dddddddd-4444-4444-8444-dddddddddddd",
      name: "Character LoRA",
      typeLabel: "LoRA",
      timestamp: "2026-01-01T00:35:00Z",
      relativeTime: "25 minutes ago",
    });
    const fallback = chainAssetRows(
      overview({ recent_assets: [{ asset_id: "ffffffff-6666-4666-8666-ffffffffffff", name: "  ", asset_type: "image", created_at: "2026-01-01T00:00:00Z" }] }),
      NOW,
    );
    expect(fallback[0]).toMatchObject({ name: "ffffffff…", typeLabel: "Image" });
  });

  it("is empty for a missing snapshot or no recent assets", () => {
    expect(chainAssetRows()).toEqual([]);
    expect(chainAssetRows(overview({ recent_assets: [] }))).toEqual([]);
  });
});

describe("chainOverviewSummaryLabel / hasChainOverviewData", () => {
  it("summarizes kind, project and whole-chain counts", () => {
    expect(chainOverviewSummaryLabel()).toBe("");
    expect(chainOverviewSummaryLabel(overview())).toBe(
      "Training chain in Short Film · 3 jobs · 2 assets",
    );
  });

  it("detects missing, empty and populated snapshots", () => {
    expect(hasChainOverviewData()).toBe(false);
    expect(
      hasChainOverviewData(overview({ counts: { jobs: 0, assets: 0 }, recent_jobs: [], recent_assets: [] })),
    ).toBe(false);
    expect(hasChainOverviewData(overview({ counts: { jobs: 0, assets: 0 }, recent_jobs: [] }))).toBe(true);
    expect(hasChainOverviewData(overview())).toBe(true);
  });
});
