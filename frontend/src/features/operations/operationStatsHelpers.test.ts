import { describe, expect, it } from "vitest";
import type { OperationStats } from "../../lib/types";
import {
  assetTypeLabel,
  hasOperationStatsData,
  operationProviderCoverage,
  operationStatsCards,
  operationStatsGeneratedAtLabel,
  operationStatsRelativeLabel,
  operationTypeRows,
} from "./operationStatsHelpers";

const populated: OperationStats = {
  total: 8,
  streaming: 3,
  with_provider: 6,
  without_provider: 2,
  total_settings: 21,
  unique_output_types: 3,
  by_output_type: [
    { asset_type: "image", operations: 5 },
    { asset_type: "video", operations: 2 },
    { asset_type: "lora", operations: 1 },
  ],
  by_input_type: [
    { asset_type: "image", operations: 4 },
    { asset_type: "dataset", operations: 2 },
  ],
  generated_at: "2026-01-01T00:00:00Z",
};

const empty: OperationStats = {
  total: 0,
  streaming: 0,
  with_provider: 0,
  without_provider: 0,
  total_settings: 0,
  unique_output_types: 0,
  by_output_type: [],
  by_input_type: [],
  generated_at: "2026-01-01T00:00:00Z",
};

describe("assetTypeLabel", () => {
  it("uses friendly labels for known types and humanizes unknown ones", () => {
    expect(assetTypeLabel("model3d")).toBe("Model 3D");
    expect(assetTypeLabel("lora")).toBe("LoRA");
    expect(assetTypeLabel("custom_type")).toBe("Custom Type");
    expect(assetTypeLabel("")).toBe("");
  });
});

describe("operationStatsCards", () => {
  it("is zero-filled and render-safe without a snapshot", () => {
    const cards = operationStatsCards(undefined);
    expect(cards.map((card) => card.key)).toEqual([
      "total",
      "streaming",
      "with_provider",
      "total_settings",
      "unique_output_types",
    ]);
    expect(cards.map((card) => card.value)).toEqual(["0", "0", "0", "0", "0"]);
  });

  it("derives the five authoritative counters", () => {
    expect(operationStatsCards(populated).map((card) => card.value)).toEqual([
      "8",
      "3",
      "6",
      "21",
      "3",
    ]);
  });
});

describe("operationProviderCoverage", () => {
  it("is neutral and zero-filled without data", () => {
    expect(operationProviderCoverage()).toEqual({
      withProvider: 0,
      withoutProvider: 0,
      coveredPercent: 0,
      coveredFraction: 0,
      tone: "neutral",
    });
    expect(operationProviderCoverage(empty)).toMatchObject({ tone: "neutral", coveredPercent: 0 });
  });

  it("derives a coverage share and tone from the with/without split", () => {
    expect(operationProviderCoverage(populated)).toEqual({
      withProvider: 6,
      withoutProvider: 2,
      coveredPercent: 75,
      coveredFraction: 0.75,
      tone: "warning",
    });
    expect(
      operationProviderCoverage({ ...populated, with_provider: 4, without_provider: 0 }).tone,
    ).toBe("success");
  });
});

describe("operationTypeRows", () => {
  it("returns no rows without a snapshot or breakdown", () => {
    expect(operationTypeRows()).toEqual([]);
    expect(operationTypeRows(empty)).toEqual([]);
    expect(operationTypeRows(empty, "input")).toEqual([]);
  });

  it("labels, sorts count-descending and derives shares for outputs", () => {
    const rows = operationTypeRows(populated);
    expect(rows.map((row) => row.assetType)).toEqual(["image", "video", "lora"]);
    expect(rows.map((row) => row.label)).toEqual(["Image", "Video", "LoRA"]);
    expect(rows[0]).toMatchObject({ operations: 5, percent: 63, fraction: 5 / 8 });
    expect(rows[2]).toMatchObject({ operations: 1, percent: 13 });
  });

  it("reads the input breakdown when requested", () => {
    const rows = operationTypeRows(populated, "input");
    expect(rows.map((row) => row.assetType)).toEqual(["image", "dataset"]);
  });

  it("breaks count ties by name and ignores malformed rows", () => {
    const rows = operationTypeRows({
      ...populated,
      by_output_type: [
        { asset_type: "z-type", operations: 2 },
        { asset_type: "a-type", operations: 2 },
        { asset_type: "bad", operations: Number.NaN },
      ],
    });
    expect(rows.map((row) => row.assetType)).toEqual(["a-type", "z-type"]);
    expect(rows.every((row) => row.percent === 25 && row.fraction === 0.25)).toBe(true);
  });

  it("keeps shares at zero when the catalog total is zero", () => {
    const rows = operationTypeRows({ ...empty, by_output_type: [{ asset_type: "image", operations: 3 }] });
    expect(rows[0]).toMatchObject({ operations: 3, percent: 0, fraction: 0 });
  });
});

describe("hasOperationStatsData / generatedAt", () => {
  it("detects empty snapshots and absent data", () => {
    expect(hasOperationStatsData()).toBe(false);
    expect(hasOperationStatsData(empty)).toBe(false);
    expect(hasOperationStatsData(populated)).toBe(true);
    expect(
      hasOperationStatsData({ ...empty, by_input_type: populated.by_input_type }),
    ).toBe(true);
  });

  it("formats a compact relative generated-at label", () => {
    const now = Date.parse("2026-01-01T00:10:05Z");
    expect(operationStatsGeneratedAtLabel(populated, now)).toBe("10 minutes ago");
    expect(operationStatsGeneratedAtLabel({ ...populated, generated_at: "not-a-date" }, now)).toBe(
      "not-a-date",
    );
    expect(operationStatsGeneratedAtLabel(undefined)).toBe("");
    expect(operationStatsRelativeLabel(null)).toBe("");
  });
});
