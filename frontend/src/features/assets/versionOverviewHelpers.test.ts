import { describe, expect, it } from "vitest";
import type { VersionOverview } from "../../lib/types";
import type { VersionFeedRow } from "./versionFeedHelpers";
import {
  VERSION_OVERVIEW_RECENT_LIMIT,
  buildVersionOverviewOptions,
  hasVersionOverviewData,
  versionOverviewActiveOption,
  versionOverviewActorLabel,
  versionOverviewCount,
  versionOverviewCountRows,
  versionOverviewEmptyDescription,
  versionOverviewGeneratedAtLabel,
  versionOverviewIdentity,
  versionOverviewPickerOptions,
  versionOverviewRecentVersions,
  versionOverviewRelativeLabel,
  versionOverviewSummaryLabel,
  versionOverviewVersionLabel,
} from "./versionOverviewHelpers";

const NOW = Date.parse("2026-01-01T12:00:00Z");

const populated: VersionOverview = {
  asset_id: "asset-aaaa-1111",
  asset_name: "Hero render",
  asset_type: "image",
  project_id: "proj-bbbb-2222",
  project_name: "A Short Film",
  version: 2,
  storage: {
    key: "pipeline/hero_v002.exr",
    size_bytes: 2_048_000,
    content_type: "image/x-exr",
  },
  created_by: "user-cccc-3333",
  created_at: "2026-01-01T09:00:00Z",
  is_latest: true,
  counts: { asset_versions: 3, revisions: 2 },
  recent_versions: [
    {
      asset_id: "asset-aaaa-1111",
      version: 3,
      storage: { key: "v3", size_bytes: 4_096_000, content_type: "image/x-exr" },
      created_at: "2026-01-01T10:00:00Z",
      created_by: "user-cccc-3333",
    },
    {
      asset_id: "asset-aaaa-1111",
      version: 2,
      storage: { key: "v2", size_bytes: 2_048_000, content_type: "image/x-exr" },
      created_at: "2026-01-01T09:00:00Z",
      created_by: "user-dddd-4444",
    },
  ],
  generated_at: "2026-01-01T11:59:00Z",
};

const rows: readonly VersionFeedRow[] = [
  {
    id: "asset-aaaa-1111:2",
    assetId: "asset-aaaa-1111",
    assetName: "Hero render",
    assetType: "image",
    typeTone: "accent",
    projectId: "proj-bbbb-2222",
    projectName: "A Short Film",
    version: 2,
    versionLabel: "v2",
    creatorId: "user-cccc-3333",
    creatorLabel: "By user-ccc…",
    timestamp: "2026-01-01T09:00:00Z",
    relativeTime: "3h ago",
  },
  {
    id: "asset-eeee-5555:1",
    assetId: "asset-eeee-5555",
    assetName: "Character design",
    assetType: "image",
    typeTone: "accent",
    projectId: "proj-ffff-6666",
    projectName: "Unknown project",
    version: 1,
    versionLabel: "v1",
    creatorId: "user-7777-8888",
    creatorLabel: "By user-777…",
    timestamp: "2026-01-01T08:00:00Z",
    relativeTime: "4h ago",
  },
];

describe("version overview display helpers", () => {
  it("returns zero-filled counts for missing, negative or malformed snapshots", () => {
    expect(versionOverviewCount(undefined)).toBe(0);
    expect(versionOverviewCount(null, "revisions")).toBe(0);
    expect(versionOverviewCount({ ...populated, counts: { asset_versions: -1, revisions: Number.NaN } }, "revisions")).toBe(0);
    expect(versionOverviewCount(populated, "asset_versions")).toBe(3);
    expect(versionOverviewCount(populated, "revisions")).toBe(2);
  });

  it("labels versions defensively", () => {
    expect(versionOverviewVersionLabel(2)).toBe("v2");
    expect(versionOverviewVersionLabel(1)).toBe("v1");
    expect(versionOverviewVersionLabel(0)).toBe("—");
    expect(versionOverviewVersionLabel(1.5)).toBe("—");
    expect(versionOverviewVersionLabel(undefined)).toBe("—");
  });

  it("formats relative and generated-at labels", () => {
    expect(versionOverviewRelativeLabel("2026-01-01T11:00:00Z", NOW)).toBeTruthy();
    expect(versionOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(versionOverviewGeneratedAtLabel(populated, NOW)).toBeTruthy();
    expect(versionOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("derives both count rows in a stable, zero-filled order", () => {
    expect(versionOverviewCountRows(populated)).toEqual([
      { key: "asset_versions", label: "Versions", hint: "Recorded version records", value: "3" },
      { key: "revisions", label: "Revisions", hint: "Versions v2 and newer", value: "2" },
    ]);
    expect(versionOverviewCountRows(undefined).map((row) => row.value)).toEqual(["0", "0"]);
  });

  it("abbreviates opaque ids", () => {
    expect(versionOverviewActorLabel("user-cccc-3333")).toBe("user-ccc…");
    expect(versionOverviewActorLabel("short")).toBe("short");
    expect(versionOverviewActorLabel(undefined)).toBe("—");
  });

  it("derives identity badges, storage and recency for a populated snapshot", () => {
    const identity = versionOverviewIdentity(populated, NOW);
    expect(identity.assetName).toBe("Hero render");
    expect(identity.typeLabel).toBe("Image");
    expect(identity.typeTone).toBe("info");
    expect(identity.versionLabel).toBe("v2");
    expect(identity.latestLabel).toBe("Latest");
    expect(identity.latestTone).toBe("success");
    expect(identity.projectLabel).toBe("A Short Film");
    expect(identity.creatorLabel).toBe("user-ccc…");
    expect(identity.storageLabel).toContain("MB");
    expect(identity.contentTypeLabel).toBe("image/x-exr");
    expect(identity.createdLabel).toBeTruthy();
  });

  it("derives an earlier-version identity and a fully zero-filled identity when missing", () => {
    const earlier = versionOverviewIdentity({ ...populated, is_latest: false }, NOW);
    expect(earlier.latestLabel).toBe("Earlier");
    expect(earlier.latestTone).toBe("neutral");

    const empty = versionOverviewIdentity(undefined, NOW);
    expect(empty.assetName).toBe("—");
    expect(empty.typeLabel).toBe("—");
    expect(empty.typeTone).toBe("neutral");
    expect(empty.versionLabel).toBe("—");
    expect(empty.projectLabel).toBe("");
    expect(empty.creatorLabel).toBe("—");
    expect(empty.contentTypeLabel).toBe("");
  });

  it("projects sibling versions with latest flags", () => {
    const siblings = versionOverviewRecentVersions(populated, NOW);
    expect(siblings).toHaveLength(2);
    expect(siblings[0]).toMatchObject({
      id: "asset-aaaa-1111:3",
      versionLabel: "v3",
      latest: false,
    });
    expect(siblings[1]).toMatchObject({ versionLabel: "v2", latest: true });
    expect(siblings[1]?.bytesLabel).toContain("MB");
    expect(versionOverviewRecentVersions(undefined, NOW)).toEqual([]);
  });

  it("detects whether the snapshot carries any data", () => {
    expect(hasVersionOverviewData(populated)).toBe(true);
    expect(hasVersionOverviewData({ ...populated, counts: { asset_versions: 0, revisions: 0 }, recent_versions: [] })).toBe(false);
    expect(hasVersionOverviewData({ ...populated, counts: { asset_versions: 0, revisions: 0 }, recent_versions: populated.recent_versions })).toBe(true);
    expect(hasVersionOverviewData(undefined)).toBe(false);
  });

  it("derives a one-line summary", () => {
    expect(versionOverviewSummaryLabel(populated)).toBe("3 versions · 2 revisions · viewing v2");
    expect(versionOverviewSummaryLabel(undefined)).toBe("");
  });

  it("provides filter-aware empty-state copy", () => {
    expect(versionOverviewEmptyDescription(true)).toContain("project");
    expect(versionOverviewEmptyDescription(false)).toContain("registered");
  });

  it("derives picker options from version-feed rows", () => {
    expect(versionOverviewPickerOptions(rows)).toEqual([
      { value: "asset-aaaa-1111:2", label: "Hero render · v2", assetId: "asset-aaaa-1111", version: 2 },
      { value: "asset-eeee-5555:1", label: "Character design · v1", assetId: "asset-eeee-5555", version: 1 },
    ]);
    expect(versionOverviewPickerOptions([])).toEqual([]);
  });

  it("resolves the active picker option with a first-row fallback", () => {
    const options = versionOverviewPickerOptions(rows);
    expect(versionOverviewActiveOption(options, "asset-eeee-5555:1")?.assetId).toBe("asset-eeee-5555");
    expect(versionOverviewActiveOption(options, "stale")?.value).toBe("asset-aaaa-1111:2");
    expect(versionOverviewActiveOption([], "")).toBeUndefined();
  });

  it("builds bounded sibling query options", () => {
    expect(VERSION_OVERVIEW_RECENT_LIMIT).toBe(5);
    expect(buildVersionOverviewOptions()).toEqual({ recentLimit: 5 });
    expect(buildVersionOverviewOptions(3)).toEqual({ recentLimit: 3 });
  });
});
