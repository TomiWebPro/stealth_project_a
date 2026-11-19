import { describe, expect, it } from "vitest";
import type { ProviderStats } from "../../lib/types";
import {
  hasProviderStatsData,
  humanizeOperationId,
  providerLocationRows,
  providerOperationRows,
  providerStatsCards,
  providerStatsGeneratedAtLabel,
  providerStatusRows,
} from "./providerStatsHelpers";

const populated: ProviderStats = {
  total: 6,
  by_status: [
    { status: "available", count: 4 },
    { status: "degraded", count: 1 },
    { status: "unavailable", count: 1 },
  ],
  by_location: [
    { location: "local", count: 2 },
    { location: "studio", count: 1 },
    { location: "cloud", count: 3 },
  ],
  available: 4,
  degraded: 1,
  unavailable: 1,
  total_capabilities: 11,
  unique_operations: 3,
  by_operation: [
    { operation_id: "image-to-video", providers: 3, available: 2 },
    { operation_id: "lora-train", providers: 2, available: 2 },
    { operation_id: "splat-train", providers: 1, available: 0 },
  ],
  generated_at: "2026-01-01T00:00:00Z",
};

const empty: ProviderStats = {
  total: 0,
  by_status: [],
  by_location: [],
  available: 0,
  degraded: 0,
  unavailable: 0,
  total_capabilities: 0,
  unique_operations: 0,
  by_operation: [],
  generated_at: "2026-01-01T00:00:00Z",
};

describe("provider stats formatters", () => {
  it("humanizes operation ids", () => {
    expect(humanizeOperationId("image-to-video")).toBe("Image To Video");
    expect(humanizeOperationId("lora_train")).toBe("Lora Train");
    expect(humanizeOperationId("")).toBe("");
  });
});

describe("providerStatsCards", () => {
  it("is zero-filled and render-safe without a snapshot", () => {
    const cards = providerStatsCards(undefined);
    expect(cards.map((card) => card.key)).toEqual([
      "total",
      "available",
      "capabilities",
      "operations",
    ]);
    expect(cards.map((card) => card.value)).toEqual(["0", "0", "0", "0"]);
  });

  it("derives the four authoritative counters", () => {
    expect(providerStatsCards(populated).map((card) => card.value)).toEqual([
      "6",
      "4",
      "11",
      "3",
    ]);
  });
});

describe("providerStatusRows", () => {
  it("zero-fills every status when the snapshot is absent or empty", () => {
    expect(providerStatusRows().map((row) => [row.status, row.count, row.percent])).toEqual([
      ["available", 0, 0],
      ["degraded", 0, 0],
      ["unavailable", 0, 0],
    ]);
    expect(providerStatusRows(empty).every((row) => row.fraction === 0)).toBe(true);
  });

  it("merges counts into the canonical order with shares and tones", () => {
    const rows = providerStatusRows(populated);
    expect(rows.map((row) => row.status)).toEqual(["available", "degraded", "unavailable"]);
    expect(rows[0]).toMatchObject({ count: 4, percent: 67, fraction: 4 / 6, tone: "success" });
    expect(rows[1]).toMatchObject({ count: 1, tone: "warning" });
    expect(rows[2]).toMatchObject({ count: 1, tone: "danger" });
  });

  it("ignores unknown or malformed status entries", () => {
    const rows = providerStatusRows({
      ...populated,
      by_status: [
        { status: "mystery" as never, count: 9 },
        { status: "available", count: Number.NaN },
      ],
    });
    expect(rows[0]?.count).toBe(0);
    expect(rows.every((row) => row.fraction === 0)).toBe(true);
  });
});

describe("providerLocationRows", () => {
  it("zero-fills every runtime location", () => {
    expect(providerLocationRows().map((row) => [row.location, row.count])).toEqual([
      ["local", 0],
      ["studio", 0],
      ["cloud", 0],
    ]);
    expect(providerLocationRows(empty).every((row) => row.percent === 0)).toBe(true);
  });

  it("merges counts in canonical order with human labels, shares and tones", () => {
    const rows = providerLocationRows(populated);
    expect(rows.map((row) => [row.location, row.label, row.count])).toEqual([
      ["local", "Local", 2],
      ["studio", "Studio", 1],
      ["cloud", "Cloud", 3],
    ]);
    expect(rows[2]).toMatchObject({ percent: 50, fraction: 0.5, tone: "neutral" });
  });
});

describe("providerOperationRows", () => {
  it("returns no rows without a snapshot", () => {
    expect(providerOperationRows()).toEqual([]);
    expect(providerOperationRows(empty)).toEqual([]);
  });

  it("humanizes, sorts by provider count and derives availability shares/tones", () => {
    const rows = providerOperationRows(populated);
    expect(rows.map((row) => row.operationId)).toEqual([
      "image-to-video",
      "lora-train",
      "splat-train",
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      "Image To Video",
      "Lora Train",
      "Splat Train",
    ]);
    expect(rows[0]).toMatchObject({
      providers: 3,
      available: 2,
      availabilityPercent: 67,
      tone: "warning",
    });
    expect(rows[1]).toMatchObject({ availabilityPercent: 100, tone: "success" });
    expect(rows[2]).toMatchObject({ availabilityPercent: 0, tone: "danger" });
  });

  it("breaks provider-count ties by id and tolerates malformed rows", () => {
    const rows = providerOperationRows({
      ...populated,
      by_operation: [
        { operation_id: "z-op", providers: 2, available: Number.NaN },
        { operation_id: "a-op", providers: 2, available: 1 },
        { operation_id: "bad", providers: Number.NaN, available: 1 },
      ],
    });
    expect(rows.map((row) => row.operationId)).toEqual(["a-op", "z-op"]);
    expect(rows[0]).toMatchObject({ availabilityFraction: 0.5, tone: "warning" });
    expect(rows[1]).toMatchObject({ available: 0, availabilityFraction: 0, tone: "danger" });
  });
});

describe("hasProviderStatsData / generatedAt", () => {
  it("detects empty snapshots and absent data", () => {
    expect(hasProviderStatsData()).toBe(false);
    expect(hasProviderStatsData(empty)).toBe(false);
    expect(hasProviderStatsData(populated)).toBe(true);
    expect(hasProviderStatsData({ ...empty, by_operation: populated.by_operation })).toBe(true);
  });

  it("formats a compact relative generated-at label", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(providerStatsGeneratedAtLabel(populated, now)).toBe("10 minutes ago");
    expect(providerStatsGeneratedAtLabel({ ...populated, generated_at: "2026-01-01T00:09:45Z" }, now)).toBe("20 seconds ago");
    expect(providerStatsGeneratedAtLabel({ ...populated, generated_at: "2025-12-30T00:00:00Z" }, now)).toBe("2 days ago");
    expect(providerStatsGeneratedAtLabel({ ...populated, generated_at: "not-a-date" }, now)).toBe("not-a-date");
    expect(providerStatsGeneratedAtLabel(undefined)).toBe("");
  });
});
