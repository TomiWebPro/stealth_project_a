import { describe, expect, it } from "vitest";
import type { VersionStats } from "../../lib/types";
import {
  hasVersionStatsData,
  newestVersionLabel,
  validVersionNumberCount,
  versionCountFor,
  versionNumberLabel,
  versionNumberRows,
  versionProjectLabel,
  versionProjectRows,
  versionRelativeLabel,
  versionStatsCards,
  versionStatsGeneratedAtLabel,
} from "./versionStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: VersionStats = {
  total_versions: 9,
  total_assets: 4,
  revisions: 5,
  by_version: [
    { version: 1, count: 4 },
    { version: 2, count: 3 },
    { version: 3, count: 2 },
  ],
  by_project: [
    { project_id: "proj-bbbb-1111", versions: 2, assets: 1 },
    { project_id: "proj-aaaa-2222", versions: 6, assets: 3 },
    { project_id: "proj-cccc-3333", versions: 1, assets: 1 },
  ],
  newest_version_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: VersionStats = {
  total_versions: 0,
  total_assets: 0,
  revisions: 0,
  by_version: [],
  by_project: [],
  newest_version_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("version stats formatters", () => {
  it("formats relative labels and treats missing or invalid timestamps safely", () => {
    expect(versionRelativeLabel(null)).toBe("");
    expect(versionRelativeLabel(undefined)).toBe("");
    expect(versionRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(versionRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("derives the newest-version and generated-at labels from the snapshot", () => {
    expect(newestVersionLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestVersionLabel(empty, NOW)).toBe("");
    expect(newestVersionLabel(undefined, NOW)).toBe("");
    expect(versionStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(versionStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("maps version numbers and project ids to compact display labels", () => {
    expect(versionNumberLabel(1)).toBe("v1");
    expect(versionNumberLabel(12)).toBe("v12");
    expect(versionProjectLabel("proj-aaaa-2222")).toBe("proj-aaa…");
    expect(versionProjectLabel("abc")).toBe("abc");
    expect(versionProjectLabel("")).toBe("Unknown");
  });

  it("counts records for one version and tolerates malformed buckets", () => {
    expect(versionCountFor(populated, 2)).toBe(3);
    expect(versionCountFor(populated, 9)).toBe(0);
    expect(
      versionCountFor({ ...populated, by_version: [{ version: 2, count: Number.NaN }] }, 2),
    ).toBe(0);
    expect(versionCountFor(undefined)).toBe(0);
  });

  it("derives the four authoritative counters in a stable order", () => {
    const cards = versionStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual(["versions", "assets", "revisions", "newest"]);
    expect(cards[0]?.value).toBe("9");
    expect(cards[1]?.value).toBe("4");
    expect(cards[2]?.value).toBe("5");
    expect(cards[3]?.value).toBe("15 minutes ago");
  });

  it("zero-fills cards for a missing snapshot", () => {
    const cards = versionStatsCards(undefined, NOW);
    expect(cards.map((card) => card.value)).toEqual(["0", "0", "0", "—"]);
  });

  it("sorts version-number rows ascending with shares that sum to about 100", () => {
    const rows = versionNumberRows({
      ...populated,
      by_version: populated.by_version ? [...populated.by_version].reverse() : [],
    });
    expect(rows.map((row) => row.version)).toEqual([1, 2, 3]);
    expect(rows.map((row) => row.label)).toEqual(["v1", "v2", "v3"]);
    expect(rows.map((row) => row.count)).toEqual([4, 3, 2]);
    expect(rows.map((row) => row.percent)).toEqual([44, 33, 22]);
    expect(rows.every((row) => row.fraction >= 0 && row.fraction <= 1)).toBe(true);
    expect(versionNumberRows(empty)).toEqual([]);
  });

  it("drops malformed version buckets from rows and parity counts", () => {
    const malformed: VersionStats = {
      ...populated,
      by_version: [
        { version: 1, count: 4 },
        { version: Number.NaN, count: 2 },
        { version: 2, count: Number.NaN },
      ],
    };
    expect(versionNumberRows(malformed).map((row) => row.version)).toEqual([1]);
    expect(validVersionNumberCount(malformed)).toBe(1);
    expect(validVersionNumberCount(empty)).toBe(0);
  });

  it("sorts project rows by descending versions then project id", () => {
    const rows = versionProjectRows(populated);
    expect(rows.map((row) => row.projectId)).toEqual([
      "proj-aaaa-2222",
      "proj-bbbb-1111",
      "proj-cccc-3333",
    ]);
    expect(rows[0]).toMatchObject({ versions: 6, assets: 3, percent: 67 });
    expect(rows.every((row) => row.fraction >= 0 && row.fraction <= 1)).toBe(true);
    expect(versionProjectRows(empty)).toEqual([]);
  });

  it("drops malformed project buckets and leaves missing snapshots empty", () => {
    const malformed: VersionStats = {
      ...populated,
      by_project: [
        { project_id: "proj-ok-0000", versions: 3, assets: 1 },
        { project_id: "proj-bad-0000", versions: Number.NaN, assets: 1 },
        { project_id: "proj-bad2-00", versions: 2, assets: Number.NaN },
      ],
    };
    expect(versionProjectRows(malformed).map((row) => row.projectId)).toEqual(["proj-ok-0000"]);
    expect(versionProjectRows(undefined)).toEqual([]);
  });

  it("detects populated versus empty version snapshots", () => {
    expect(hasVersionStatsData(populated)).toBe(true);
    expect(hasVersionStatsData(empty)).toBe(false);
    expect(hasVersionStatsData(undefined)).toBe(false);
  });
});
