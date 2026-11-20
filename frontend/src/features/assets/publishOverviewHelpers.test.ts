import { describe, expect, it } from "vitest";
import type { PublishFeedItem, PublishOverview } from "../../lib/types";
import {
  buildPublishOverviewOptions,
  buildPublishPickerFeedOptions,
  hasPublishOverviewData,
  publishOverviewActiveOption,
  publishOverviewCount,
  publishOverviewCountRows,
  publishOverviewEmptyDescription,
  publishOverviewGeneratedAtLabel,
  publishOverviewIdentity,
  publishOverviewPickerOptions,
  publishOverviewRecentSiblings,
  publishOverviewRelativeLabel,
  publishOverviewSummaryLabel,
  publishOverviewVersionLabel,
  PUBLISH_OVERVIEW_PICKER_LIMIT,
  PUBLISH_OVERVIEW_RECENT_LIMITS,
} from "./publishOverviewHelpers";
import type { PublishFeedRow } from "./publishFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const A1 = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const A2 = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const P1 = "11111111-1111-4111-8111-111111111111";

function sibling(overrides: Partial<PublishFeedItem> = {}): PublishFeedItem {
  return {
    asset_id: A1,
    asset_name: "Opening frame",
    asset_type: "image",
    project_id: P1,
    project_name: "Short Film",
    version: 2,
    size_bytes: 2048,
    published_at: "2026-01-01T00:50:00Z",
    ...overrides,
  };
}

function overview(overrides: Partial<PublishOverview> = {}): PublishOverview {
  return {
    asset_id: A1,
    asset_name: "Opening frame",
    asset_type: "image",
    project_id: P1,
    project_name: "Short Film",
    version: 2,
    size_bytes: 2048,
    published_at: "2026-01-01T00:50:00Z",
    counts: { project_published: 3, project_bytes: 6144, total_published: 9 },
    recent_siblings: [
      sibling(),
      sibling({
        asset_id: A2,
        asset_name: "End frame",
        version: 1,
        size_bytes: 4096,
        published_at: "2026-01-01T00:40:00Z",
      }),
    ],
    generated_at: "2026-01-01T00:59:00Z",
    ...overrides,
  };
}

describe("buildPublishOverviewOptions", () => {
  it("defaults to the first published recent-limit chip", () => {
    expect(buildPublishOverviewOptions()).toEqual({ recentLimit: PUBLISH_OVERVIEW_RECENT_LIMITS[0] });
  });

  it("honours an explicit recent limit", () => {
    expect(buildPublishOverviewOptions(25)).toEqual({ recentLimit: 25 });
  });
});

describe("buildPublishPickerFeedOptions", () => {
  it("uses the bounded picker limit with no scope", () => {
    expect(buildPublishPickerFeedOptions()).toEqual({ limit: PUBLISH_OVERVIEW_PICKER_LIMIT });
  });

  it("adds the project scope when provided", () => {
    expect(buildPublishPickerFeedOptions(P1)).toEqual({ projectId: P1, limit: PUBLISH_OVERVIEW_PICKER_LIMIT });
  });
});

describe("publishOverviewCount", () => {
  it("returns each canonical count verbatim", () => {
    const data = overview();
    expect(publishOverviewCount(data, "project_published")).toBe(3);
    expect(publishOverviewCount(data, "project_bytes")).toBe(6144);
    expect(publishOverviewCount(data, "total_published")).toBe(9);
  });

  it("zero-fills when the snapshot or a count is absent or malformed", () => {
    expect(publishOverviewCount(undefined)).toBe(0);
    expect(publishOverviewCount({ ...overview(), counts: { project_published: -1, project_bytes: Number.NaN, total_published: 0 } }, "project_published")).toBe(0);
    expect(publishOverviewCount({ ...overview(), counts: { project_published: 0, project_bytes: Number.NaN, total_published: 0 } }, "project_bytes")).toBe(0);
  });
});

describe("publishOverviewVersionLabel", () => {
  it("formats positive integer versions", () => {
    expect(publishOverviewVersionLabel(2)).toBe("v2");
  });

  it("returns an em dash for missing or invalid versions", () => {
    expect(publishOverviewVersionLabel(undefined)).toBe("—");
    expect(publishOverviewVersionLabel(0)).toBe("—");
    expect(publishOverviewVersionLabel(1.5)).toBe("—");
  });
});

describe("relative labels", () => {
  it("formats timestamps relative to the supplied clock", () => {
    expect(publishOverviewRelativeLabel("2026-01-01T00:50:00Z", NOW)).not.toBe("");
    expect(publishOverviewRelativeLabel(undefined, NOW)).toBe("");
  });

  it("derives the generated-at footer label", () => {
    expect(publishOverviewGeneratedAtLabel(overview(), NOW)).not.toBe("");
    expect(publishOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("publishOverviewCountRows", () => {
  it("emits three stable, formatted count cards", () => {
    const rows = publishOverviewCountRows(overview());
    expect(rows.map((row) => row.key)).toEqual(["project_published", "project_bytes", "total_published"]);
    expect(rows[0]?.value).toBe("3");
    expect(rows[1]?.value).toBe("6.0 KB");
    expect(rows[2]?.value).toBe("9");
  });

  it("zero-fills all cards when the snapshot is absent", () => {
    const rows = publishOverviewCountRows(undefined);
    expect(rows.map((row) => row.value)).toEqual(["0", "0 B", "0"]);
  });
});

describe("publishOverviewIdentity", () => {
  it("derives identity, type, version, bytes and recency", () => {
    const identity = publishOverviewIdentity(overview(), NOW);
    expect(identity.assetName).toBe("Opening frame");
    expect(identity.typeLabel).toBeTruthy();
    expect(identity.versionLabel).toBe("v2");
    expect(identity.sizeLabel).toBe("2.0 KB");
    expect(identity.projectLabel).toBe("Short Film");
    expect(identity.publishedLabel).not.toBe("");
  });

  it("returns render-safe placeholders for a missing snapshot", () => {
    const identity = publishOverviewIdentity(undefined, NOW);
    expect(identity.assetName).toBe("—");
    expect(identity.typeLabel).toBe("—");
    expect(identity.versionLabel).toBe("—");
    expect(identity.sizeLabel).toBe("—");
    expect(identity.publishedLabel).toBe("—");
    expect(identity.projectLabel).toBe("");
  });
});

describe("publishOverviewRecentSiblings", () => {
  it("projects siblings and highlights the selected asset", () => {
    const rows = publishOverviewRecentSiblings(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.selected).toBe(true);
    expect(rows[1]?.selected).toBe(false);
    expect(rows[1]?.versionLabel).toBe("v1");
    expect(rows[1]?.sizeLabel).toBe("4.0 KB");
    expect(rows[0]?.timestamp).toBe("2026-01-01T00:50:00Z");
  });

  it("returns an empty list when the snapshot has no siblings", () => {
    expect(publishOverviewRecentSiblings(undefined, NOW)).toEqual([]);
    expect(publishOverviewRecentSiblings({ ...overview(), recent_siblings: [] }, NOW)).toEqual([]);
  });
});

describe("hasPublishOverviewData", () => {
  it("is false for a missing or fully zero-filled snapshot", () => {
    expect(hasPublishOverviewData()).toBe(false);
    expect(
      hasPublishOverviewData({
        ...overview(),
        counts: { project_published: 0, project_bytes: 0, total_published: 0 },
        recent_siblings: [],
      }),
    ).toBe(false);
  });

  it("is true when any count or sibling is present", () => {
    expect(hasPublishOverviewData(overview())).toBe(true);
    expect(
      hasPublishOverviewData({
        ...overview(),
        counts: { project_published: 0, project_bytes: 0, total_published: 0 },
      }),
    ).toBe(true);
  });
});

describe("publishOverviewSummaryLabel", () => {
  it("summarises scoped and workspace totals plus the viewed version", () => {
    expect(publishOverviewSummaryLabel(overview())).toContain("3 in this project");
    expect(publishOverviewSummaryLabel(overview())).toContain("9 workspace-wide");
    expect(publishOverviewSummaryLabel(overview())).toContain("viewing v2");
    expect(publishOverviewSummaryLabel(undefined)).toBe("");
  });
});

describe("publishOverviewEmptyDescription", () => {
  it("varies with the project scope", () => {
    expect(publishOverviewEmptyDescription(true)).toContain("project");
    expect(publishOverviewEmptyDescription(false)).toContain("assets");
  });
});

describe("picker options", () => {
  const rows: PublishFeedRow[] = [
    {
      id: A1,
      assetId: A1,
      assetName: "Opening frame",
      assetType: "image",
      typeTone: "info",
      projectId: P1,
      projectName: "Short Film",
      versionLabel: "v2",
      sizeLabel: "2.0 KB",
      timestamp: "2026-01-01T00:50:00Z",
      relativeTime: "10m ago",
    },
    {
      id: A2,
      assetId: A2,
      assetName: "End frame",
      assetType: "image",
      typeTone: "info",
      projectId: P1,
      projectName: "Short Film",
      versionLabel: "v1",
      sizeLabel: "4.0 KB",
      timestamp: "2026-01-01T00:40:00Z",
      relativeTime: "20m ago",
    },
  ];

  it("maps feed rows to picker options keyed by asset id", () => {
    const options = publishOverviewPickerOptions(rows);
    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({ value: A1, assetId: A1, projectId: P1 });
    expect(options[0]?.label).toContain("Opening frame");
  });

  it("resolves the active option and falls back to the first", () => {
    const options = publishOverviewPickerOptions(rows);
    expect(publishOverviewActiveOption(options, A2)?.value).toBe(A2);
    expect(publishOverviewActiveOption(options, "missing")?.value).toBe(A1);
    expect(publishOverviewActiveOption([], "")).toBeUndefined();
  });
});
