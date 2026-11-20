import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { OperationCatalog, Provider } from "./types";
import { deriveProviderOverview } from "./providerOverview";

const PROVIDER_A = "prov_test";

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: PROVIDER_A,
    name: "Test Provider",
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
      { id: "text-to-image", title: "Text to image", schema_version: "v1" },
      { id: "upscale", title: "Upscale", schema_version: "v2" },
    ],
  };
}

describe("deriveProviderOverview", () => {
  it("derives a zero-filled snapshot for a provider with no capabilities", () => {
    expect(deriveProviderOverview(PROVIDER_A, [provider()], catalog(), REFERENCE_NOW)).toEqual({
      provider_id: PROVIDER_A,
      name: "Test Provider",
      location: "local",
      status: "available",
      metadata: {},
      operation_ids: [],
      catalog_operations: [],
      counts: {
        capabilities: 0,
        advertised_operations: 0,
        catalog_operations: 0,
        schema_versions: 0,
      },
      generated_at: REFERENCE_NOW,
    });
  });

  it("sorts and deduplicates advertised operations and versions, binding catalog entries", () => {
    const overview = deriveProviderOverview(
      PROVIDER_A,
      [
        provider({
          name: "ComfyUI",
          location: "studio",
          status: "degraded",
          metadata: { gpu: "M60" },
          capabilities: [
            { operation_id: "upscale", schema_versions: ["v2", "v1"] },
            { operation_id: "text-to-image", schema_versions: ["v1"] },
            // A second capability for the same operation is merged and re-sorted.
            { operation_id: "upscale", schema_versions: ["v3"] },
          ],
        }),
      ],
      catalog(),
      REFERENCE_NOW,
    );

    expect(overview.name).toBe("ComfyUI");
    expect(overview.location).toBe("studio");
    expect(overview.status).toBe("degraded");
    expect(overview.metadata).toEqual({ gpu: "M60" });
    expect(overview.operation_ids).toEqual(["text-to-image", "upscale"]);
    expect(overview.catalog_operations).toEqual([
      {
        operation_id: "text-to-image",
        title: "Text to image",
        catalog_version: "v1",
        advertised_versions: ["v1"],
        schema_match: true,
      },
      {
        operation_id: "upscale",
        title: "Upscale",
        catalog_version: "v2",
        advertised_versions: ["v1", "v2", "v3"],
        schema_match: true,
      },
    ]);
    expect(overview.counts).toEqual({
      capabilities: 3,
      advertised_operations: 2,
      catalog_operations: 2,
      schema_versions: 3,
    });
  });

  it("flags schema drift and omits advertised operations absent from the catalog", () => {
    const overview = deriveProviderOverview(
      PROVIDER_A,
      [
        provider({
          capabilities: [
            { operation_id: "upscale", schema_versions: ["v1"] },
            { operation_id: "unknown-op", schema_versions: ["v9"] },
          ],
        }),
      ],
      catalog(),
      REFERENCE_NOW,
    );

    expect(overview.operation_ids).toEqual(["unknown-op", "upscale"]);
    expect(overview.catalog_operations).toEqual([
      {
        operation_id: "upscale",
        title: "Upscale",
        catalog_version: "v2",
        advertised_versions: ["v1"],
        schema_match: false,
      },
    ]);
    expect(overview.counts).toEqual({
      capabilities: 2,
      advertised_operations: 2,
      catalog_operations: 1,
      schema_versions: 2,
    });
  });

  it("counts a capability with no advertised versions without inventing versions", () => {
    const overview = deriveProviderOverview(
      PROVIDER_A,
      [provider({ capabilities: [{ operation_id: "text-to-image" }] })],
      catalog(),
      REFERENCE_NOW,
    );
    expect(overview.operation_ids).toEqual(["text-to-image"]);
    expect(overview.catalog_operations?.[0]?.advertised_versions).toEqual([]);
    expect(overview.catalog_operations?.[0]?.schema_match).toBe(false);
    expect(overview.counts.schema_versions).toBe(0);
  });

  it("throws a normalized 404 for an unknown provider", () => {
    expect(() => deriveProviderOverview("missing", [], catalog(), REFERENCE_NOW)).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "provider_not_found" }),
    );
    expect(() => deriveProviderOverview("missing", [], catalog(), REFERENCE_NOW)).toThrow(
      ApiError,
    );
  });
});
