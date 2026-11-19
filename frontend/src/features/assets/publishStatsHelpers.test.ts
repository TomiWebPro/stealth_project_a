import { describe, expect, it } from "vitest";
import type { PublishStats } from "../../lib/types";
import {
  formatByteSize,
  hasPublishStatsData,
  newestPublishLabel,
  publishCountFor,
  publishProjectLabel,
  publishProjectRows,
  publishRelativeLabel,
  publishStatsCards,
  publishStatsGeneratedAtLabel,
  publishVersionLabel,
  publishVersionRows,
  validVersionCount,
} from "./publishStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: PublishStats = {
  total_published: 9,
  total_bytes: 4 * 1024 * 1024 + 512 * 1024,
  by_version: [
    { version: 1, count: 4 },
    { version: 2, count: 3 },
    { version: 3, count: 2 },
  ],
  by_project: [
    { project_id: "proj-bbbb-1111", published: 2, bytes: 1024 },
    { project_id: "proj-aaaa-2222", published: 6, bytes: 4 * 1024 * 1024 },
    { project_id: "proj-cccc-3333", published: 1, bytes: 512 * 1024 },
  ],
  newest_published_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: PublishStats = {
  total_published: 0,
  total_bytes: 0,
  by_version: [],
  by_project: [],
  newest_published_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("publish stats formatters", () => {
  it("formats byte sizes safely for missing, fractional and large values", () => {
    expect(formatByteSize(undefined)).toBe("—");
    expect(formatByteSize(null)).toBe("—");
    expect(formatByteSize(Number.NaN)).toBe("—");
    expect(formatByteSize(-1)).toBe("—");
    expect(formatByteSize(0)).toBe("0 B");
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(1024)).toBe("1.0 KB");
    expect(formatByteSize(4.5 * 1024 * 1024)).toBe("4.5 MB");
  });

  it("formats relative labels and treats missing or invalid timestamps safely", () => {
    expect(publishRelativeLabel(null)).toBe("");
    expect(publishRelativeLabel(undefined)).toBe("");
    expect(publishRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(publishRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("derives the newest-publish and generated-at labels from the snapshot", () => {
    expect(newestPublishLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestPublishLabel(empty, NOW)).toBe("");
    expect(newestPublishLabel(undefined, NOW)).toBe("");
    expect(publishStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(publishStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("maps version numbers and project ids to compact display labels", () => {
    expect(publishVersionLabel(1)).toBe("v1");
    expect(publishVersionLabel(12)).toBe("v12");
    expect(publishProjectLabel("proj-aaaa-2222")).toBe("proj-aaa…");
    expect(publishProjectLabel("abc")).toBe("abc");
    expect(publishProjectLabel("")).toBe("Unknown");
  });

  it("counts publishes for one version and tolerates malformed buckets", () => {
    expect(publishCountFor(populated, 2)).toBe(3);
    expect(publishCountFor(populated, 9)).toBe(0);
    expect(
      publishCountFor({ ...populated, by_version: [{ version: 2, count: Number.NaN }] }, 2),
    ).toBe(0);
    expect(publishCountFor(undefined)).toBe(0);
  });

  it("derives the four authoritative cards in a stable order", () => {
    const cards = publishStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual(["published", "delivered", "versions", "newest"]);
    expect(cards[0]?.value).toBe("9");
    expect(cards[1]?.value).toBe("4.5 MB");
    expect(cards[2]?.value).toBe("3");
    expect(cards[3]?.value).toBe("15 minutes ago");
  });

  it("zero-fills cards for a missing snapshot", () => {
    const cards = publishStatsCards(undefined, NOW);
    expect(cards.map((card) => card.value)).toEqual(["0", "—", "0", "—"]);
  });

  it("sorts version rows ascending with shares that sum to about 100", () => {
    const rows = publishVersionRows({
      ...populated,
      by_version: populated.by_version ? [...populated.by_version].reverse() : [],
    });
    expect(rows.map((row) => row.version)).toEqual([1, 2, 3]);
    expect(rows.map((row) => row.label)).toEqual(["v1", "v2", "v3"]);
    expect(rows.map((row) => row.count)).toEqual([4, 3, 2]);
    expect(rows.map((row) => row.percent)).toEqual([44, 33, 22]);
    expect(rows.every((row) => row.fraction >= 0 && row.fraction <= 1)).toBe(true);
    expect(publishVersionRows(empty)).toEqual([]);
  });

  it("drops malformed version buckets from rows and parity counts", () => {
    const malformed: PublishStats = {
      ...populated,
      by_version: [
        { version: 1, count: 4 },
        { version: Number.NaN, count: 2 },
        { version: 2, count: Number.NaN },
      ],
    };
    expect(publishVersionRows(malformed).map((row) => row.version)).toEqual([1]);
    expect(validVersionCount(malformed)).toBe(1);
    expect(validVersionCount(empty)).toBe(0);
  });

  it("sorts project rows by descending published count then project id", () => {
    const rows = publishProjectRows(populated);
    expect(rows.map((row) => row.projectId)).toEqual([
      "proj-aaaa-2222",
      "proj-bbbb-1111",
      "proj-cccc-3333",
    ]);
    expect(rows[0]).toMatchObject({ published: 6, bytesLabel: "4.0 MB", percent: 67 });
    expect(rows.every((row) => row.fraction >= 0 && row.fraction <= 1)).toBe(true);
    expect(publishProjectRows(empty)).toEqual([]);
  });

  it("drops malformed project buckets and leaves missing snapshots empty", () => {
    const malformed: PublishStats = {
      ...populated,
      by_project: [
        { project_id: "proj-ok-0000", published: 3, bytes: 100 },
        { project_id: "proj-bad-0000", published: Number.NaN, bytes: 100 },
        { project_id: "proj-bad2-00", published: 2, bytes: Number.NaN },
      ],
    };
    expect(publishProjectRows(malformed).map((row) => row.projectId)).toEqual(["proj-ok-0000"]);
    expect(publishProjectRows(undefined)).toEqual([]);
  });

  it("detects populated versus empty publish snapshots", () => {
    expect(hasPublishStatsData(populated)).toBe(true);
    expect(hasPublishStatsData(empty)).toBe(false);
    expect(hasPublishStatsData(undefined)).toBe(false);
  });
});
