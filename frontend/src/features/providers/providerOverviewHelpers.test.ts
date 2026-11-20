import { describe, expect, it } from "vitest";
import type { Provider, ProviderOverview } from "../../lib/types";
import {
  hasProviderOverviewData,
  providerOptionLabel,
  providerOverviewCoverage,
  providerOverviewCounts,
  providerOverviewGeneratedAtLabel,
  providerOverviewIdentity,
  providerOverviewOperationRows,
  providerOverviewRelativeLabel,
  providerOverviewSchemaMatchCount,
  providerOverviewShortId,
  providerOverviewStatRows,
  providerOverviewSummaryLabel,
  providerOverviewUnboundOperationIds,
} from "./providerOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function overview(overrides: Partial<ProviderOverview> = {}): ProviderOverview {
  return {
    provider_id: "prov_local_comfyui",
    name: "Local ComfyUI",
    location: "local",
    status: "available",
    metadata: { version: "1.0" },
    operation_ids: ["image-to-video", "lora-train", "unknown-op"],
    catalog_operations: [
      {
        operation_id: "image-to-video",
        title: "Image to Video",
        catalog_version: "1.0",
        advertised_versions: ["1.0"],
        schema_match: true,
      },
      {
        operation_id: "lora-train",
        title: "LoRA Train",
        catalog_version: "2.0",
        advertised_versions: ["1.0"],
        schema_match: false,
      },
    ],
    counts: {
      capabilities: 3,
      advertised_operations: 3,
      catalog_operations: 2,
      schema_versions: 2,
    },
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function emptyOverview(): ProviderOverview {
  return overview({
    operation_ids: [],
    catalog_operations: [],
    counts: {
      capabilities: 0,
      advertised_operations: 0,
      catalog_operations: 0,
      schema_versions: 0,
    },
  });
}

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "prov_local_comfyui",
    name: "Local ComfyUI",
    location: "local",
    status: "available",
    capabilities: [],
    ...overrides,
  } as Provider;
}

describe("providerOverview formatters", () => {
  it("formats relative labels defensively", () => {
    expect(providerOverviewRelativeLabel(null)).toBe("");
    expect(providerOverviewRelativeLabel(undefined)).toBe("");
    expect(providerOverviewRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(providerOverviewRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("formats the generated-at footer label", () => {
    expect(providerOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
    expect(providerOverviewGeneratedAtLabel(undefined)).toBe("");
  });

  it("derives defensive short-id and picker labels", () => {
    expect(providerOverviewShortId("prov_local_comfyui")).toBe("prov_local_comfy…");
    expect(providerOverviewShortId("short")).toBe("short");
    expect(providerOverviewShortId(undefined)).toBe("—");
    expect(providerOptionLabel(provider())).toBe("Local ComfyUI · prov_local_comfyui");
    expect(providerOptionLabel(provider({ name: "  ", id: "p1" }))).toBe("Unnamed provider · p1");
    expect(providerOptionLabel(provider({ id: "" }))).toBe("Local ComfyUI");
  });

  it("zero-fills malformed coverage counts", () => {
    expect(providerOverviewCounts(overview())).toEqual({
      capabilities: 3,
      advertisedOperations: 3,
      catalogOperations: 2,
      schemaVersions: 2,
    });
    expect(providerOverviewCounts(overview({ counts: {} as ProviderOverview["counts"] }))).toEqual({
      capabilities: 0,
      advertisedOperations: 0,
      catalogOperations: 0,
      schemaVersions: 0,
    });
    expect(
      providerOverviewCounts(
        overview({
          counts: {
            capabilities: -1,
            advertised_operations: -2,
            catalog_operations: -3,
            schema_versions: -4,
          },
        }),
      ),
    ).toEqual({
      capabilities: 0,
      advertisedOperations: 0,
      catalogOperations: 0,
      schemaVersions: 0,
    });
    expect(providerOverviewCounts(undefined).advertisedOperations).toBe(0);
  });
});

describe("providerOverviewIdentity", () => {
  it("derives identity and health for a populated snapshot", () => {
    expect(providerOverviewIdentity(overview())).toEqual({
      nameLabel: "Local ComfyUI",
      providerIdLabel: "prov_local_comfy…",
      locationLabel: "Local",
      statusLabel: "Available",
      statusTone: "success",
    });
  });

  it("reuses provider health tones for degraded and unavailable providers", () => {
    expect(providerOverviewIdentity(overview({ status: "degraded" }))).toMatchObject({
      statusLabel: "Degraded",
      statusTone: "warning",
    });
    expect(providerOverviewIdentity(overview({ status: "unavailable" }))).toMatchObject({
      statusLabel: "Unavailable",
      statusTone: "danger",
    });
  });

  it("is defensive for a missing snapshot, name or status", () => {
    expect(providerOverviewIdentity(undefined)).toEqual({
      nameLabel: "Unknown provider",
      providerIdLabel: "—",
      locationLabel: "Unknown",
      statusLabel: "Unknown",
      statusTone: "neutral",
    });
    expect(providerOverviewIdentity(overview({ name: "  ", status: undefined, location: undefined }))).toMatchObject({
      nameLabel: "Unknown provider",
      locationLabel: "Unknown",
      statusLabel: "Unknown",
      statusTone: "neutral",
    });
  });
});

describe("providerOverviewStatRows", () => {
  it("derives the four headline counters in a stable order", () => {
    const rows = providerOverviewStatRows(overview());
    expect(rows.map((row) => row.key)).toEqual([
      "capabilities",
      "advertised",
      "catalog",
      "versions",
    ]);
    expect(rows.map((row) => row.value)).toEqual(["3", "3", "2", "2"]);
    expect(rows.every((row) => row.label && row.hint)).toBe(true);
  });

  it("zero-fills every counter when the snapshot is absent", () => {
    expect(providerOverviewStatRows(undefined).map((row) => row.value)).toEqual([
      "0",
      "0",
      "0",
      "0",
    ]);
  });
});

describe("providerOverviewOperationRows", () => {
  it("projects catalog bindings with schema-match badges", () => {
    const rows = providerOverviewOperationRows(overview());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      key: "image-to-video",
      operationId: "image-to-video",
      title: "Image to Video",
      catalogVersion: "1.0",
      advertisedVersionsLabel: "1.0",
      schemaLabel: "Match",
      schemaTone: "success",
      drift: false,
    });
    expect(rows[1]).toMatchObject({
      schemaLabel: "Drift",
      schemaTone: "warning",
      drift: true,
      advertisedVersionsLabel: "1.0",
    });
  });

  it("is defensive for missing titles, versions and empty snapshots", () => {
    const rows = providerOverviewOperationRows(
      overview({
        catalog_operations: [
          {
            operation_id: "",
            title: "  ",
            catalog_version: "",
            schema_match: true,
          },
        ],
      }),
    );
    expect(rows[0]).toMatchObject({
      key: "0",
      operationId: "operation-0",
      title: "operation-0",
      catalogVersion: "—",
      advertisedVersionsLabel: "—",
    });
    expect(providerOverviewOperationRows(undefined)).toEqual([]);
    expect(providerOverviewOperationRows(overview({ catalog_operations: undefined }))).toEqual([]);
  });
});

describe("providerOverview coverage helpers", () => {
  it("finds advertised operations with no catalog binding", () => {
    expect(providerOverviewUnboundOperationIds(overview())).toEqual(["unknown-op"]);
    expect(
      providerOverviewUnboundOperationIds(
        overview({ catalog_operations: [], operation_ids: ["a", "b"] }),
      ),
    ).toEqual(["a", "b"]);
    expect(providerOverviewUnboundOperationIds(undefined)).toEqual([]);
  });

  it("derives schema-match coverage as a clamped fraction and percent", () => {
    expect(providerOverviewSchemaMatchCount(overview())).toBe(1);
    expect(providerOverviewCoverage(overview())).toEqual({
      matched: 1,
      total: 2,
      fraction: 0.5,
      percent: 50,
    });
    expect(providerOverviewCoverage(emptyOverview())).toEqual({
      matched: 0,
      total: 0,
      fraction: 0,
      percent: 0,
    });
    expect(providerOverviewCoverage(undefined).percent).toBe(0);
  });
});

describe("hasProviderOverviewData", () => {
  it("is false for a missing or entirely inactive snapshot", () => {
    expect(hasProviderOverviewData(undefined)).toBe(false);
    expect(hasProviderOverviewData(emptyOverview())).toBe(false);
  });

  it("is true when a count, advertised id or catalog binding is present", () => {
    expect(hasProviderOverviewData(overview())).toBe(true);
    expect(
      hasProviderOverviewData(overview({ operation_ids: ["a"], catalog_operations: [] })),
    ).toBe(true);
    expect(
      hasProviderOverviewData(
        overview({
          operation_ids: [],
          catalog_operations: [],
          counts: {
            capabilities: 1,
            advertised_operations: 0,
            catalog_operations: 0,
            schema_versions: 0,
          },
        }),
      ),
    ).toBe(true);
  });
});

describe("providerOverviewSummaryLabel", () => {
  it("summarizes advertised/catalog/schema counts with pluralization", () => {
    expect(providerOverviewSummaryLabel(overview())).toBe(
      "3 advertised · 2 catalog-bound · 1 schema match",
    );
    // Counts are authoritative and never bounded by the catalog projection.
    expect(providerOverviewSummaryLabel(overview({ catalog_operations: [] }))).toBe(
      "3 advertised · 2 catalog-bound · 0 schema matches",
    );
    expect(providerOverviewSummaryLabel(emptyOverview())).toBe(
      "0 advertised · 0 catalog-bound · 0 schema matches",
    );
    expect(providerOverviewSummaryLabel(undefined)).toBe("");
  });
});
