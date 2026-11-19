import { describe, expect, it } from "vitest";
import type { ProjectStats } from "../../lib/types";
import {
  formatAverage,
  hasProjectStatsData,
  projectAverageRows,
  projectDomainRows,
  projectLifecycleRows,
  projectStatsCards,
  projectStatsGeneratedAtLabel,
  projectStatsRelativeLabel,
} from "./projectStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: ProjectStats = {
  total: 8,
  by_lifecycle: [
    { lifecycle: "active", count: 6 },
    { lifecycle: "archived", count: 2 },
  ],
  active: 6,
  archived: 2,
  total_assets: 24,
  total_conversations: 9,
  total_jobs: 41,
  average_assets_per_project: 3.0,
  average_jobs_per_project: 5.125,
  newest_project_at: "2026-01-01T00:30:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: ProjectStats = {
  total: 0,
  by_lifecycle: [
    { lifecycle: "active", count: 0 },
    { lifecycle: "archived", count: 0 },
  ],
  active: 0,
  archived: 0,
  total_assets: 0,
  total_conversations: 0,
  total_jobs: 0,
  average_assets_per_project: 0,
  average_jobs_per_project: 0,
  newest_project_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("project stats formatters", () => {
  it("formats per-project averages without trailing zeros and with safe fallbacks", () => {
    expect(formatAverage(3)).toBe("3");
    expect(formatAverage(5.125)).toBe("5.13");
    expect(formatAverage(0)).toBe("0");
    expect(formatAverage(undefined)).toBe("—");
    expect(formatAverage(null)).toBe("—");
    expect(formatAverage(Number.NaN)).toBe("—");
    expect(formatAverage(-1)).toBe("—");
  });

  it("formats relative labels and treats invalid timestamps as raw values", () => {
    expect(projectStatsRelativeLabel(null)).toBe("");
    expect(projectStatsRelativeLabel(undefined)).toBe("");
    expect(projectStatsRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(projectStatsRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });
});

describe("projectStatsCards", () => {
  it("derives the four portfolio counters in a stable order", () => {
    const cards = projectStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual(["total", "active", "archived", "newest"]);
    expect(cards[0]?.value).toBe("8");
    expect(cards[1]?.value).toBe("6");
    expect(cards[2]?.value).toBe("2");
    expect(cards[3]?.value).toBe("30 minutes ago");
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(projectStatsCards(undefined, NOW).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0",
      "—",
    ]);
    expect(projectStatsCards(empty, NOW)[3]?.value).toBe("—");
  });
});

describe("projectLifecycleRows", () => {
  it("returns a complete zero-filled active/archived breakdown with shares", () => {
    const rows = projectLifecycleRows(populated);
    expect(rows.map((row) => row.lifecycle)).toEqual(["active", "archived"]);
    expect(rows[0]).toMatchObject({ label: "Active", count: 6, percent: 75, fraction: 0.75, tone: "success" });
    expect(rows[1]).toMatchObject({ label: "Archived", count: 2, percent: 25, fraction: 0.25, tone: "neutral" });
  });

  it("ignores malformed entries and never divides by zero on empty snapshots", () => {
    const rows = projectLifecycleRows({
      ...populated,
      by_lifecycle: [
        { lifecycle: "active", count: Number.NaN },
        { lifecycle: "archived", count: 4 },
      ],
    });
    expect(rows[0]?.count).toBe(0);
    expect(rows[1]?.percent).toBe(100);
    expect(projectLifecycleRows(undefined).every((row) => row.fraction === 0)).toBe(true);
    expect(projectLifecycleRows(empty).every((row) => row.percent === 0)).toBe(true);
  });
});

describe("projectDomainRows", () => {
  it("derives cross-domain document totals", () => {
    const rows = projectDomainRows(populated);
    expect(rows.map((row) => row.key)).toEqual(["assets", "conversations", "jobs"]);
    expect(rows.map((row) => row.value)).toEqual(["24", "9", "41"]);
  });

  it("zero-fills when the snapshot is absent", () => {
    expect(projectDomainRows(undefined).map((row) => row.value)).toEqual(["0", "0", "0"]);
  });
});

describe("projectAverageRows", () => {
  it("derives per-project averages with safe fallbacks", () => {
    const rows = projectAverageRows(populated);
    expect(rows.map((row) => row.value)).toEqual(["3", "5.13"]);
    expect(projectAverageRows(empty).map((row) => row.value)).toEqual(["0", "0"]);
    expect(projectAverageRows(undefined).map((row) => row.value)).toEqual(["—", "—"]);
  });
});

describe("hasProjectStatsData", () => {
  it("reports presence for populated snapshots only", () => {
    expect(hasProjectStatsData(populated)).toBe(true);
    expect(hasProjectStatsData(empty)).toBe(false);
    expect(hasProjectStatsData(undefined)).toBe(false);
    expect(hasProjectStatsData({ ...empty, total_jobs: 1 })).toBe(true);
  });
});

describe("projectStatsGeneratedAtLabel", () => {
  it("derives the snapshot footer label", () => {
    expect(projectStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(projectStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});
