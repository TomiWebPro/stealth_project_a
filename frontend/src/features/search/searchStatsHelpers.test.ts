import { describe, expect, it } from "vitest";
import type { SearchStats } from "../../lib/types";
import {
  hasSearchStatsData,
  newestDocumentLabel,
  searchKindLabel,
  searchKindRows,
  searchRelativeLabel,
  searchStatsCards,
  searchStatsGeneratedAtLabel,
  validSearchKindCount,
} from "./searchStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: SearchStats = {
  total_documents: 10,
  by_kind: [
    { kind: "project", count: 2 },
    { kind: "asset", count: 5 },
    { kind: "conversation", count: 3 },
  ],
  newest_document_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: SearchStats = {
  total_documents: 0,
  by_kind: [
    { kind: "project", count: 0 },
    { kind: "asset", count: 0 },
    { kind: "conversation", count: 0 },
  ],
  newest_document_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("search stats formatters", () => {
  it("formats relative labels and treats missing or invalid timestamps safely", () => {
    expect(searchRelativeLabel(null)).toBe("");
    expect(searchRelativeLabel(undefined)).toBe("");
    expect(searchRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(searchRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("derives the newest-document label from the snapshot", () => {
    expect(newestDocumentLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestDocumentLabel(empty, NOW)).toBe("");
    expect(newestDocumentLabel(undefined, NOW)).toBe("");
  });

  it("maps canonical kinds to human labels", () => {
    expect(searchKindLabel("project")).toBe("Project");
    expect(searchKindLabel("asset")).toBe("Asset");
    expect(searchKindLabel("conversation")).toBe("Conversation");
  });
});

describe("searchStatsCards", () => {
  it("derives totals, coverage and newest-document signals in a stable order", () => {
    const cards = searchStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual([
      "documents",
      "newest",
      "kinds",
      "coverage",
    ]);
    expect(cards.map((card) => card.value)).toEqual([
      "10",
      "15 minutes ago",
      "3",
      "100%",
    ]);
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(searchStatsCards(undefined, NOW).map((card) => card.value)).toEqual([
      "0",
      "—",
      "0",
      "0%",
    ]);
    expect(searchStatsCards(empty, NOW).map((card) => card.value)).toEqual([
      "0",
      "—",
      "0",
      "0%",
    ]);
  });

  it("reports partial coverage when only some kinds have documents", () => {
    const cards = searchStatsCards(
      {
        ...populated,
        by_kind: [
          { kind: "project", count: 4 },
          { kind: "asset", count: 0 },
          { kind: "conversation", count: 0 },
        ],
      },
      NOW,
    );
    expect(cards[2]?.value).toBe("1");
    expect(cards[3]?.value).toBe("33%");
  });
});

describe("searchKindRows", () => {
  it("returns a complete zero-filled project/asset/conversation breakdown with shares", () => {
    const rows = searchKindRows(populated);
    expect(rows.map((row) => row.kind)).toEqual(["project", "asset", "conversation"]);
    expect(rows[0]).toMatchObject({ label: "Project", count: 2, percent: 20, fraction: 0.2 });
    expect(rows[1]).toMatchObject({ label: "Asset", count: 5, percent: 50 });
    expect(rows[2]).toMatchObject({ label: "Conversation", count: 3, percent: 30 });
  });

  it("ignores malformed entries and never divides by zero on empty snapshots", () => {
    const rows = searchKindRows({
      ...populated,
      by_kind: [
        { kind: "project", count: Number.NaN },
        { kind: "asset", count: 4 },
      ],
    });
    expect(rows[0]?.count).toBe(0);
    expect(rows[1]?.percent).toBe(100);
    expect(searchKindRows(undefined).every((row) => row.fraction === 0)).toBe(true);
    expect(searchKindRows(empty).every((row) => row.percent === 0)).toBe(true);
  });
});

describe("hasSearchStatsData and validSearchKindCount", () => {
  it("detects empty snapshots from the authoritative document total", () => {
    expect(hasSearchStatsData(populated)).toBe(true);
    expect(hasSearchStatsData(empty)).toBe(false);
    expect(hasSearchStatsData(undefined)).toBe(false);
    expect(hasSearchStatsData({ ...empty, total_documents: 3 })).toBe(true);
  });

  it("counts only well-formed kind buckets", () => {
    expect(validSearchKindCount(populated)).toBe(3);
    expect(validSearchKindCount(empty)).toBe(3);
    expect(
      validSearchKindCount({ ...populated, by_kind: [{ kind: "asset", count: Number.NaN }] }),
    ).toBe(0);
    expect(validSearchKindCount(undefined)).toBe(0);
  });
});

describe("searchStatsGeneratedAtLabel", () => {
  it("derives a generated-at footer label", () => {
    expect(searchStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(searchStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});
