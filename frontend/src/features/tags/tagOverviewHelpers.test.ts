import { describe, expect, it } from "vitest";
import type { AssetFeedItem, TagOverview } from "../../lib/types";
import {
  buildTagOverviewOptions,
  buildTagOverviewPickerOptions,
  hasTagOverviewData,
  tagOverviewActiveOption,
  tagOverviewCount,
  tagOverviewCountRows,
  tagOverviewEmptyDescription,
  tagOverviewGeneratedAtLabel,
  tagOverviewIdentity,
  tagOverviewPickerOptions,
  tagOverviewRecentAssets,
  tagOverviewSummaryLabel,
  TAG_OVERVIEW_DEFAULT_RECENT_LIMIT,
  TAG_OVERVIEW_PICKER_LIMIT,
  TAG_OVERVIEW_RECENT_LIMITS,
} from "./tagOverviewHelpers";
import type { TagFacetItem } from "./tagHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const A1 = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const A2 = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const P1 = "11111111-1111-4111-8111-111111111111";

function asset(overrides: Partial<AssetFeedItem> = {}): AssetFeedItem {
  return {
    asset_id: A1,
    project_id: P1,
    project_name: "Short Film",
    type: "image",
    name: "Opening frame",
    status: "ready",
    version: 2,
    size_bytes: 2048,
    created_at: "2026-01-01T00:50:00Z",
    updated_at: "2026-01-01T00:50:00Z",
    ...overrides,
  };
}

function overview(overrides: Partial<TagOverview> = {}): TagOverview {
  return {
    tag: "lora",
    project_id: P1,
    project_name: "Short Film",
    counts: { tagged_assets: 3, tagged_projects: 2, scope_assets: 12 },
    recent_assets: [
      asset(),
      asset({
        asset_id: A2,
        name: "End frame",
        type: "video",
        version: 1,
        size_bytes: 4096,
        created_at: "2026-01-01T00:40:00Z",
      }),
    ],
    generated_at: "2026-01-01T00:59:00Z",
    ...overrides,
  };
}

describe("buildTagOverviewOptions", () => {
  it("defaults to the first recent-limit chip with no scope", () => {
    expect(buildTagOverviewOptions()).toEqual({ recentLimit: TAG_OVERVIEW_DEFAULT_RECENT_LIMIT });
  });

  it("honours an explicit recent limit and project scope", () => {
    expect(buildTagOverviewOptions(25, P1)).toEqual({ recentLimit: 25, projectId: P1 });
  });

  it("omits an empty project scope", () => {
    expect(buildTagOverviewOptions(10, "")).toEqual({ recentLimit: 10 });
  });
});

describe("buildTagOverviewPickerOptions", () => {
  it("uses the bounded picker limit with no scope", () => {
    expect(buildTagOverviewPickerOptions()).toEqual({ limit: TAG_OVERVIEW_PICKER_LIMIT });
  });

  it("adds the project scope when provided", () => {
    expect(buildTagOverviewPickerOptions(P1)).toEqual({ projectId: P1, limit: TAG_OVERVIEW_PICKER_LIMIT });
  });
});

describe("tagOverviewCount", () => {
  it("returns each canonical count verbatim", () => {
    const data = overview();
    expect(tagOverviewCount(data, "tagged_assets")).toBe(3);
    expect(tagOverviewCount(data, "tagged_projects")).toBe(2);
    expect(tagOverviewCount(data, "scope_assets")).toBe(12);
  });

  it("zero-fills when the snapshot or a count is missing/malformed", () => {
    expect(tagOverviewCount()).toBe(0);
    expect(tagOverviewCount(overview({ counts: undefined as never }))).toBe(0);
    expect(tagOverviewCount(overview({ counts: { ...overview().counts, tagged_assets: -1 } }))).toBe(0);
    expect(tagOverviewCount(overview({ counts: { ...overview().counts, tagged_assets: Number.NaN } }))).toBe(0);
  });
});

describe("tagOverviewCountRows", () => {
  it("exposes the three whole-scope counters in a stable order", () => {
    const rows = tagOverviewCountRows(overview());
    expect(rows.map((row) => row.key)).toEqual(["tagged_assets", "tagged_projects", "scope_assets"]);
    expect(rows.map((row) => row.value)).toEqual(["3", "2", "12"]);
    expect(rows.every((row) => row.label.length > 0 && row.hint.length > 0)).toBe(true);
  });

  it("zero-fills when the snapshot is absent", () => {
    expect(tagOverviewCountRows().map((row) => row.value)).toEqual(["0", "0", "0"]);
  });
});

describe("tagOverviewIdentity", () => {
  it("builds the tag label, joined scope and recency", () => {
    const identity = tagOverviewIdentity(overview(), NOW);
    expect(identity.tagLabel).toBe("#lora");
    expect(identity.projectLabel).toBe("Short Film");
    expect(identity.scopeLabel).toBe("Short Film");
    expect(identity.generatedLabel).toBe("1 minute ago");
  });

  it("falls back to a workspace scope when the project is not joined", () => {
    const identity = tagOverviewIdentity(overview({ project_name: null, project_id: null }), NOW);
    expect(identity.scopeLabel).toBe("Whole workspace");
    expect(identity.projectLabel).toBe("");
    expect(identity.generatedLabel).toBe("1 minute ago");
  });

  it("returns safe placeholders when the snapshot is absent", () => {
    const identity = tagOverviewIdentity(undefined, NOW);
    expect(identity.tagLabel).toBe("#—");
    expect(identity.scopeLabel).toBe("Whole workspace");
    expect(identity.generatedLabel).toBe("—");
  });
});

describe("tagOverviewRecentAssets", () => {
  it("maps canonical feed items into render-ready rows without inline JSX work", () => {
    const rows = tagOverviewRecentAssets(overview(), NOW);
    expect(rows.map((row) => row.assetId)).toEqual([A1, A2]);
    expect(rows[0]).toMatchObject({
      assetName: "Opening frame",
      typeLabel: "Image",
      versionLabel: "v2",
      sizeLabel: "2.0 KB",
      relativeTime: "10 minutes ago",
      projectName: "Short Film",
    });
    expect(rows[1]).toMatchObject({ assetName: "End frame", versionLabel: "v1" });
  });

  it("returns no rows for a missing or empty snapshot", () => {
    expect(tagOverviewRecentAssets()).toEqual([]);
    expect(tagOverviewRecentAssets(overview({ recent_assets: [] }))).toEqual([]);
  });
});

describe("tagOverviewGeneratedAtLabel / summary / data detection", () => {
  it("derives recency and a one-line summary", () => {
    expect(tagOverviewGeneratedAtLabel(overview(), NOW)).toBe("1 minute ago");
    expect(tagOverviewGeneratedAtLabel(overview({ generated_at: undefined as never }), NOW)).toBe("");
    expect(tagOverviewSummaryLabel(overview())).toBe("3 tagged assets · 2 projects · 12 in scope");
  });

  it("detects populated and empty snapshots", () => {
    expect(hasTagOverviewData(overview())).toBe(true);
    expect(hasTagOverviewData(overview({ counts: { tagged_assets: 0, tagged_projects: 0, scope_assets: 0 }, recent_assets: [] }))).toBe(false);
    expect(hasTagOverviewData(undefined)).toBe(false);
  });

  it("offers scope-aware empty copy", () => {
    expect(tagOverviewEmptyDescription(true)).toContain("this project");
    expect(tagOverviewEmptyDescription(false)).toContain("workspace");
  });
});

describe("tagOverviewPickerOptions / active option", () => {
  const facets: TagFacetItem[] = [
    { name: "lora", count: 4, countLabel: "4 assets", sharePercent: 100, tone: "accent" },
    { name: "char", count: 2, countLabel: "2 assets", sharePercent: 50, tone: "info" },
  ];

  it("maps index facets to picker options keyed by tag name", () => {
    const options = tagOverviewPickerOptions(facets);
    expect(options.map((option) => option.value)).toEqual(["lora", "char"]);
    expect(options[0]?.label).toBe("lora · 4 assets");
  });

  it("resolves the selected option and falls back to the first", () => {
    const options = tagOverviewPickerOptions(facets);
    expect(tagOverviewActiveOption(options, "char")?.value).toBe("char");
    expect(tagOverviewActiveOption(options, "missing")?.value).toBe("lora");
    expect(tagOverviewActiveOption([], "lora")).toBeUndefined();
  });

  it("exposes the canonical recent-limit chips", () => {
    expect(TAG_OVERVIEW_RECENT_LIMITS).toEqual([TAG_OVERVIEW_DEFAULT_RECENT_LIMIT, 10, 25]);
  });
});
