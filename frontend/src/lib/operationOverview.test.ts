import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { OperationCatalog, Provider } from "./types";
import { deriveOperationOverview } from "./operationOverview";

const OPERATION_ID = "text-to-image";

function provider(id: string, overrides: Partial<Provider> = {}): Provider {
  return {
    id,
    name: `Provider ${id}`,
    location: "local",
    status: "available",
    capabilities: [],
    metadata: {},
    ...overrides,
  };
}

function catalog(): OperationCatalog {
  return {
    version: "v1",
    operations: [
      {
        id: OPERATION_ID,
        title: "Text to image",
        description: "Generate a frame.",
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
        id: "bare",
        title: "Bare operation",
        schema_version: "v2",
      },
    ],
  };
}

describe("deriveOperationOverview", () => {
  it("derives a zero-filled snapshot for an operation with no advertising providers", () => {
    expect(deriveOperationOverview("bare", [], catalog(), REFERENCE_NOW)).toEqual({
      operation_id: "bare",
      title: "Bare operation",
      description: null,
      schema_version: "v2",
      input_types: [],
      output_types: [],
      setting_keys: [],
      streaming: false,
      provider_ids: [],
      provider_bindings: [],
      counts: {
        settings: 0,
        input_types: 0,
        output_types: 0,
        provider_bindings: 0,
        matching_providers: 0,
      },
      generated_at: REFERENCE_NOW,
    });
  });

  it("sorts/deduplicates provider bindings, schema versions, setting keys and declared ids", () => {
    const overview = deriveOperationOverview(
      OPERATION_ID,
      [
        provider("prov_z", {
          name: "Zeta",
          location: "cloud",
          status: "degraded",
          capabilities: [
            { operation_id: OPERATION_ID, schema_versions: ["v2", "v1"] },
            { operation_id: OPERATION_ID, schema_versions: ["v1", "v3"] },
            { operation_id: "other-op", schema_versions: ["v9"] },
          ],
        }),
        provider("prov_a", {
          name: "Alpha",
          capabilities: [{ operation_id: OPERATION_ID, schema_versions: ["v1"] }],
        }),
        provider("prov_mute", {
          capabilities: [{ operation_id: "other-op", schema_versions: ["v1"] }],
        }),
      ],
      {
        version: "v1",
        operations: [
          {
            id: OPERATION_ID,
            title: "Text to image",
            schema_version: "v2",
            provider_ids: ["prov_z", "prov_a", "prov_z"],
            output: { asset_types: ["image"] },
            settings: [
              { key: "seed", label: "Seed", type: "integer" },
              { key: "seed", label: "Seed again", type: "integer" },
            ],
          },
        ],
      },
      REFERENCE_NOW,
    );

    expect(overview.provider_ids).toEqual(["prov_a", "prov_z"]);
    expect(overview.setting_keys).toEqual(["seed"]);
    expect(overview.provider_bindings).toEqual([
      {
        provider_id: "prov_a",
        name: "Alpha",
        location: "local",
        status: "available",
        advertised_versions: ["v1"],
        schema_match: false,
      },
      {
        provider_id: "prov_z",
        name: "Zeta",
        location: "cloud",
        status: "degraded",
        advertised_versions: ["v1", "v2", "v3"],
        schema_match: true,
      },
    ]);
    expect(overview.counts).toEqual({
      settings: 2,
      input_types: 0,
      output_types: 1,
      provider_bindings: 2,
      matching_providers: 1,
    });
  });

  it("throws a normalized 404 for an unknown operation", () => {
    expect(() => deriveOperationOverview("missing", [], catalog(), REFERENCE_NOW)).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "operation_not_found" }),
    );
    expect(() => deriveOperationOverview("missing", [], catalog(), REFERENCE_NOW)).toThrow(
      ApiError,
    );
  });
});
