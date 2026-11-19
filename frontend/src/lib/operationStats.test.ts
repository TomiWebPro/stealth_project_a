import { describe, expect, it } from "vitest";

import type { OperationSpec } from "./types";
import { deriveOperationStats } from "./operationStats";
import { OPERATION_CATALOG, REFERENCE_NOW } from "./mock/data";

const OPERATIONS: readonly OperationSpec[] = [
  {
    id: "text-to-image",
    title: "Text to image",
    schema_version: "v1",
    streaming: false,
    input: { asset_types: [] },
    output: { asset_types: ["image"] },
    settings: [
      { key: "width", label: "Width", type: "integer" },
      { key: "height", label: "Height", type: "integer" },
    ],
  },
  {
    id: "image-to-image",
    title: "Image to image",
    schema_version: "v1",
    input: { asset_types: ["image"] },
    output: { asset_types: ["image"] },
  },
  {
    id: "image-to-video",
    title: "Image to video",
    schema_version: "v1",
    streaming: true,
    provider_ids: ["prov_local"],
    input: { asset_types: ["image"] },
    output: { asset_types: ["video"] },
    settings: [{ key: "fps", label: "FPS", type: "integer" }],
  },
  {
    id: "upscale",
    title: "Upscale",
    schema_version: "v1",
    provider_ids: ["prov_cloud"],
    input: { asset_types: ["image", "video"] },
    output: { asset_types: ["image", "video"] },
  },
];

describe("deriveOperationStats", () => {
  it("zero-fills every metric for an empty catalog", () => {
    expect(deriveOperationStats([], REFERENCE_NOW)).toEqual({
      total: 0,
      streaming: 0,
      with_provider: 0,
      without_provider: 0,
      total_settings: 0,
      unique_output_types: 0,
      by_output_type: [],
      by_input_type: [],
      generated_at: REFERENCE_NOW,
    });
  });

  it("derives coverage and deterministic asset-type breakdowns", () => {
    const stats = deriveOperationStats(OPERATIONS, REFERENCE_NOW);

    expect(stats.total).toBe(4);
    expect(stats.streaming).toBe(1);
    expect(stats.with_provider).toBe(2);
    expect(stats.without_provider).toBe(2);
    expect(stats.total_settings).toBe(3);
    expect(stats.unique_output_types).toBe(2);
    expect(stats.by_output_type).toEqual([
      { asset_type: "image", operations: 3 },
      { asset_type: "video", operations: 2 },
    ]);
    expect(stats.by_input_type).toEqual([
      { asset_type: "image", operations: 3 },
      { asset_type: "video", operations: 1 },
    ]);
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("breaks equal counts by asset type name", () => {
    const tied: OperationSpec[] = [
      { id: "b", title: "B", schema_version: "v1", output: { asset_types: ["zeta"] } },
      { id: "a", title: "A", schema_version: "v1", output: { asset_types: ["alpha"] } },
    ];
    expect(deriveOperationStats(tied, REFERENCE_NOW).by_output_type).toEqual([
      { asset_type: "alpha", operations: 1 },
      { asset_type: "zeta", operations: 1 },
    ]);
  });

  it("derives the shipped catalog snapshot used by both transports", () => {
    const stats = deriveOperationStats(OPERATION_CATALOG.operations ?? [], REFERENCE_NOW);

    expect(stats.total).toBe(10);
    expect(stats.streaming).toBe(3);
    expect(stats.with_provider).toBe(0);
    expect(stats.without_provider).toBe(10);
    expect(stats.total_settings).toBe(8);
    expect(stats.unique_output_types).toBe(6);
    expect(stats.by_output_type?.[0]).toEqual({ asset_type: "video", operations: 4 });
    expect(stats.by_input_type?.[0]).toEqual({ asset_type: "image", operations: 6 });
  });
});
