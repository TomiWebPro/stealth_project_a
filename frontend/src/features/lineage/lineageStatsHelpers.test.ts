import { describe, expect, it } from "vitest";
import type { LineageStats, RelationshipType } from "../../lib/types";
import {
  hasLineageStatsData,
  lineageProjectLabel,
  lineageProjectRows,
  lineageStatsCards,
  lineageStatsGeneratedAtLabel,
  lineageStatsRelativeLabel,
  lineageTypeLabel,
  lineageTypeRows,
  lineageTypeTone,
  newestRelationshipLabel,
} from "./lineageStatsHelpers";

const populated: LineageStats = {
  total_relationships: 6,
  total_linked_assets: 4,
  by_type: [
    { type: "derived_from", count: 3 },
    { type: "variant_of", count: 1 },
    { type: "uses_input", count: 2 },
    { type: "related_to", count: 0 },
    { type: "duplicate_of", count: 0 },
  ],
  by_project: [
    { project_id: "aaaaaaaa-1111", relationships: 4 },
    { project_id: "bbbbbbbb-2222", relationships: 2 },
  ],
  newest_relationship_at: "2026-01-01T00:00:00Z",
  generated_at: "2026-01-01T00:10:05Z",
};

const empty: LineageStats = {
  total_relationships: 0,
  total_linked_assets: 0,
  by_type: [
    { type: "derived_from", count: 0 },
    { type: "variant_of", count: 0 },
    { type: "uses_input", count: 0 },
    { type: "related_to", count: 0 },
    { type: "duplicate_of", count: 0 },
  ],
  by_project: [],
  newest_relationship_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("labels and tones", () => {
  it("uses friendly labels and stable tones for canonical types", () => {
    expect(lineageTypeLabel("derived_from")).toBe("Derived from");
    expect(lineageTypeLabel("variant_of")).toBe("Variant of");
    expect(lineageTypeLabel("uses_input")).toBe("Uses input");
    expect(lineageTypeLabel("related_to")).toBe("Related to");
    expect(lineageTypeLabel("duplicate_of")).toBe("Duplicate of");
    expect(lineageTypeLabel("custom_kind")).toBe("Custom Kind");
    expect(lineageTypeTone("derived_from")).toBe("info");
    expect(lineageTypeTone("variant_of")).toBe("accent");
    expect(lineageTypeTone("uses_input")).toBe("warning");
    expect(lineageTypeTone("related_to")).toBe("neutral");
    expect(lineageTypeTone("duplicate_of")).toBe("danger");
    expect(lineageTypeTone("other")).toBe("neutral");
    expect(lineageTypeLabel("toString")).toBe("ToString");
    expect(lineageTypeTone("toString")).toBe("neutral");
  });

  it("shortens long project ids and keeps short ones intact", () => {
    expect(lineageProjectLabel("aaaaaaaa-1111-2222")).toBe("aaaaaaaa…");
    expect(lineageProjectLabel("abc")).toBe("abc");
    expect(lineageProjectLabel("")).toBe("");
  });
});

describe("lineageStatsCards", () => {
  it("is zero-filled and render-safe without a snapshot", () => {
    const cards = lineageStatsCards(undefined);
    expect(cards.map((card) => card.key)).toEqual(["relationships", "assets", "types"]);
    expect(cards.map((card) => card.value)).toEqual(["0", "0", "0"]);
  });

  it("derives the authoritative counters and types in use", () => {
    expect(lineageStatsCards(populated).map((card) => card.value)).toEqual(["6", "4", "3"]);
    expect(lineageStatsCards(empty).map((card) => card.value)).toEqual(["0", "0", "0"]);
  });
});

describe("lineageTypeRows", () => {
  it("is zero-filled in canonical order without a snapshot", () => {
    const rows = lineageTypeRows();
    expect(rows.map((row) => row.type)).toEqual([
      "derived_from",
      "variant_of",
      "uses_input",
      "related_to",
      "duplicate_of",
    ]);
    expect(rows.every((row) => row.count === 0 && row.percent === 0 && row.fraction === 0)).toBe(
      true,
    );
  });

  it("derives per-type counts and relationship shares", () => {
    const rows = lineageTypeRows(populated);
    expect(rows.map((row) => row.type)).toEqual([
      "derived_from",
      "variant_of",
      "uses_input",
      "related_to",
      "duplicate_of",
    ]);
    expect(rows.map((row) => row.count)).toEqual([3, 1, 2, 0, 0]);
    expect(rows[0]).toMatchObject({ percent: 50, fraction: 0.5, tone: "info" });
    expect(rows[2]).toMatchObject({ percent: 33, fraction: 1 / 3, tone: "warning" });
  });

  it("appends unknown kinds after the canonical five and ignores malformed rows", () => {
    const rows = lineageTypeRows({
      ...populated,
      by_type: [
        { type: "duplicate_of", count: 1 },
        { type: "derived_from", count: Number.NaN },
        { type: "extra" as RelationshipType, count: 2 },
      ],
    });
    expect(rows.map((row) => row.type)).toEqual([
      "derived_from",
      "variant_of",
      "uses_input",
      "related_to",
      "duplicate_of",
      "extra",
    ]);
    expect(rows[0]?.count).toBe(0);
    expect(rows[5]?.count).toBe(2);
  });

  it("keeps shares at zero when the relationship total is zero", () => {
    const rows = lineageTypeRows({
      ...empty,
      by_type: [{ type: "variant_of", count: 3 }],
    });
    expect(rows.find((row) => row.type === "variant_of")).toMatchObject({
      count: 3,
      percent: 0,
      fraction: 0,
    });
  });
});

describe("lineageProjectRows", () => {
  it("returns no rows without a snapshot or breakdown", () => {
    expect(lineageProjectRows()).toEqual([]);
    expect(lineageProjectRows(empty)).toEqual([]);
  });

  it("sorts count-descending, derives shares and labels, and respects the limit", () => {
    const rows = lineageProjectRows(populated);
    expect(rows.map((row) => row.projectId)).toEqual(["aaaaaaaa-1111", "bbbbbbbb-2222"]);
    expect(rows.map((row) => row.label)).toEqual(["aaaaaaaa…", "bbbbbbbb…"]);
    expect(rows[0]).toMatchObject({ relationships: 4, percent: 67, fraction: 4 / 6 });
    expect(lineageProjectRows(populated, 1)).toHaveLength(1);
  });

  it("breaks count ties by project id and ignores malformed rows", () => {
    const rows = lineageProjectRows({
      ...populated,
      by_project: [
        { project_id: "z-project", relationships: 2 },
        { project_id: "a-project", relationships: 2 },
        { project_id: "bad", relationships: Number.NaN },
      ],
    });
    expect(rows.map((row) => row.projectId)).toEqual(["a-project", "z-project"]);
    expect(rows.every((row) => row.percent === 33 && row.fraction === 1 / 3)).toBe(true);
  });
});

describe("hasLineageStatsData / relative labels", () => {
  it("detects empty snapshots and absent data", () => {
    expect(hasLineageStatsData()).toBe(false);
    expect(hasLineageStatsData(empty)).toBe(false);
    expect(hasLineageStatsData(populated)).toBe(true);
    expect(hasLineageStatsData({ ...empty, total_relationships: 2 })).toBe(true);
    expect(
      hasLineageStatsData({ ...empty, by_type: [{ type: "related_to", count: 1 }] }),
    ).toBe(true);
    expect(
      hasLineageStatsData({
        ...empty,
        by_project: [{ project_id: "p", relationships: 1 }],
      }),
    ).toBe(true);
  });

  it("formats compact relative recency and generated-at labels", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(lineageStatsGeneratedAtLabel(populated, now)).toBe("now");
    expect(newestRelationshipLabel(populated, now)).toBe("10 minutes ago");
    expect(newestRelationshipLabel(empty)).toBe("");
    expect(lineageStatsRelativeLabel(null)).toBe("");
    expect(lineageStatsRelativeLabel("not-a-date", now)).toBe("not-a-date");
    expect(lineageStatsGeneratedAtLabel(undefined)).toBe("");
  });
});
