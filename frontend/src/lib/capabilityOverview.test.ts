import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { OperationCatalog, Provider } from "./types";
import { deriveCapabilityOverview, isKnownCapability } from "./capabilityOverview";

const OPERATION_ID = "text-to-image";

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "prov_test",
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

describe("deriveCapabilityOverview", () => {
  it("derives a zero-filled catalog-only snapshot with no advertising providers", () => {
    expect(deriveCapabilityOverview(OPERATION_ID, [], catalog(), REFERENCE_NOW)).toEqual({
      operation_id: OPERATION_ID,
      in_catalog: true,
      catalog_title: "Text to image",
      catalog_version: "v1",
      providers: [],
      counts: {
        total_providers: 0,
        available: 0,
        degraded: 0,
        unavailable: 0,
        locations: 0,
        schema_versions: 0,
      },
      generated_at: REFERENCE_NOW,
    });
  });

  it("projects each advertising provider once with sorted/deduped versions and status/location counts", () => {
    const overview = deriveCapabilityOverview(
      OPERATION_ID,
      [
        provider({
          id: "prov_b",
          name: "Studio",
          location: "studio",
          status: "degraded",
          capabilities: [
            { operation_id: OPERATION_ID, schema_versions: ["v2", "v1"] },
            { operation_id: "upscale", schema_versions: ["v2"] },
            { operation_id: OPERATION_ID, schema_versions: ["v1", "v3"] },
          ],
        }),
        provider({
          id: "prov_a",
          name: "Local",
          location: "local",
          status: "available",
          capabilities: [{ operation_id: OPERATION_ID, schema_versions: ["v1"] }],
        }),
        provider({
          id: "prov_c",
          name: "Cloud",
          location: "cloud",
          status: "unavailable",
          capabilities: [{ operation_id: OPERATION_ID }],
        }),
        provider({ id: "prov_d", capabilities: [{ operation_id: "upscale", schema_versions: ["v2"] }] }),
      ],
      catalog(),
      REFERENCE_NOW,
    );

    expect(overview.providers).toEqual([
      {
        provider_id: "prov_a",
        name: "Local",
        location: "local",
        status: "available",
        schema_versions: ["v1"],
        schema_match: true,
      },
      {
        provider_id: "prov_b",
        name: "Studio",
        location: "studio",
        status: "degraded",
        schema_versions: ["v1", "v2", "v3"],
        schema_match: true,
      },
      {
        provider_id: "prov_c",
        name: "Cloud",
        location: "cloud",
        status: "unavailable",
        schema_versions: [],
        schema_match: false,
      },
    ]);
    expect(overview.counts).toEqual({
      total_providers: 3,
      available: 1,
      degraded: 1,
      unavailable: 1,
      locations: 3,
      schema_versions: 3,
    });
  });

  it("reports schema drift for a catalog capability with only mismatched versions", () => {
    const overview = deriveCapabilityOverview(
      OPERATION_ID,
      [provider({ capabilities: [{ operation_id: OPERATION_ID, schema_versions: ["v9"] }] })],
      catalog(),
      REFERENCE_NOW,
    );
    expect(overview.in_catalog).toBe(true);
    expect(overview.providers?.[0]?.schema_match).toBe(false);
    expect(overview.counts.schema_versions).toBe(1);
  });

  it("derives an advertised-only capability absent from the catalog", () => {
    const overview = deriveCapabilityOverview(
      "ghost-op",
      [provider({ capabilities: [{ operation_id: "ghost-op", schema_versions: ["v9", "v1"] }] })],
      catalog(),
      REFERENCE_NOW,
    );
    expect(overview.in_catalog).toBe(false);
    expect(overview.catalog_title).toBeNull();
    expect(overview.catalog_version).toBeNull();
    expect(overview.providers?.[0]).toMatchObject({
      schema_versions: ["v1", "v9"],
      schema_match: false,
    });
    expect(overview.counts.total_providers).toBe(1);
  });

  it("knows catalog or advertised capabilities and rejects a truly unknown one", () => {
    expect(isKnownCapability(OPERATION_ID, [], catalog())).toBe(true);
    expect(
      isKnownCapability("ghost-op", [provider({ capabilities: [{ operation_id: "ghost-op" }] })], catalog()),
    ).toBe(true);
    expect(isKnownCapability("missing", [], catalog())).toBe(false);

    expect(() => deriveCapabilityOverview("missing", [], catalog(), REFERENCE_NOW)).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "capability_not_found" }),
    );
    expect(() => deriveCapabilityOverview("missing", [], catalog(), REFERENCE_NOW)).toThrow(
      ApiError,
    );
  });
});
