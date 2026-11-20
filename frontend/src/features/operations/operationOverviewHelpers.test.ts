import { describe, expect, it } from "vitest";
import type {
  OperationOverview,
  OperationProviderBinding,
  OperationSpec,
} from "../../lib/types";
import {
  hasOperationOverviewData,
  operationOptionLabel,
  operationOverviewBindingRows,
  operationOverviewCoverage,
  operationOverviewCounts,
  operationOverviewDeclaredProviderIds,
  operationOverviewGeneratedAtLabel,
  operationOverviewIdentity,
  operationOverviewRelativeLabel,
  operationOverviewSchemaMatchCount,
  operationOverviewSettingKeysLabel,
  operationOverviewShortId,
  operationOverviewStatRows,
  operationOverviewSummaryLabel,
  operationOverviewTypesLabel,
  operationOverviewUnboundProviderIds,
} from "./operationOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function overview(overrides: Partial<OperationOverview> = {}): OperationOverview {
  return {
    operation_id: "text-to-image",
    title: "Text to Image",
    description: "Generate an image from a prompt.",
    schema_version: "1.0",
    input_types: ["scene", "dataset"],
    output_types: ["image"],
    setting_keys: ["steps", "seed", "guidance"],
    streaming: true,
    provider_ids: ["local-comfyui", "cloud-render", "retired-provider"],
    provider_bindings: [
      {
        provider_id: "cloud-render",
        name: "Cloud Render",
        location: "cloud",
        status: "degraded",
        advertised_versions: ["1.0"],
        schema_match: true,
      },
      {
        provider_id: "local-comfyui",
        name: "Local ComfyUI",
        location: "local",
        status: "available",
        advertised_versions: ["1.0", "2.0"],
        schema_match: false,
      },
    ],
    counts: {
      settings: 3,
      input_types: 2,
      output_types: 1,
      provider_bindings: 2,
      matching_providers: 1,
    },
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function emptyOverview(): OperationOverview {
  return overview({
    description: null,
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
  });
}

function spec(overrides: Partial<OperationSpec> = {}): OperationSpec {
  return {
    id: "text-to-image",
    title: "Text to Image",
    schema_version: "1.0",
    ...overrides,
  };
}

describe("operationOverviewRelativeLabel / operationOverviewGeneratedAtLabel", () => {
  it("returns an empty label for a missing timestamp", () => {
    expect(operationOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(operationOverviewRelativeLabel(null, NOW)).toBe("");
  });

  it("derives a relative label for a present timestamp", () => {
    expect(operationOverviewRelativeLabel("2026-01-01T00:59:00Z", NOW)).toMatch(/ago|now/);
  });

  it("derives the generated-at footer label from the snapshot", () => {
    expect(operationOverviewGeneratedAtLabel(overview(), NOW)).toMatch(/ago|now/);
    expect(operationOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("operationOverviewShortId / operationOptionLabel", () => {
  it("returns a dash for a missing operation id and keeps short ids intact", () => {
    expect(operationOverviewShortId(undefined)).toBe("—");
    expect(operationOverviewShortId("text-to-image")).toBe("text-to-image");
  });

  it("truncates long operation ids", () => {
    const long = "a".repeat(30);
    expect(operationOverviewShortId(long)).toBe(`${"a".repeat(24)}…`);
  });

  it("labels an option with title and id, with sensible fallbacks", () => {
    expect(operationOptionLabel(spec())).toBe("Text to Image · text-to-image");
    expect(operationOptionLabel(spec({ title: "  " }))).toBe("Untitled operation · text-to-image");
    expect(operationOptionLabel(spec({ id: "" }))).toBe("Text to Image");
  });
});

describe("operationOverviewCounts", () => {
  it("is zero-filled for undefined/null snapshots", () => {
    const zero = {
      settings: 0,
      input_types: 0,
      output_types: 0,
      provider_bindings: 0,
      matching_providers: 0,
    };
    expect(operationOverviewCounts(undefined)).toEqual(zero);
    expect(operationOverviewCounts(null)).toEqual(zero);
  });

  it("preserves authoritative counts from the snapshot", () => {
    expect(operationOverviewCounts(overview())).toEqual({
      settings: 3,
      input_types: 2,
      output_types: 1,
      provider_bindings: 2,
      matching_providers: 1,
    });
  });

  it("coerces malformed count values to zero", () => {
    const malformed = overview({
      counts: {
        settings: -5,
        input_types: Number.NaN,
        output_types: 2.9,
        provider_bindings: 1,
        matching_providers: 0,
      },
    });
    expect(operationOverviewCounts(malformed)).toEqual({
      settings: 0,
      input_types: 0,
      output_types: 2,
      provider_bindings: 1,
      matching_providers: 0,
    });
  });
});

describe("operationOverviewIdentity", () => {
  it("derives identity and streaming badges for a populated snapshot", () => {
    expect(operationOverviewIdentity(overview())).toEqual({
      titleLabel: "Text to Image",
      operationIdLabel: "text-to-image",
      description: "Generate an image from a prompt.",
      schemaLabel: "1.0",
      streamingLabel: "Streaming",
      streamingTone: "info",
    });
  });

  it("falls back to render-safe labels for a missing snapshot", () => {
    expect(operationOverviewIdentity(undefined)).toEqual({
      titleLabel: "Unknown operation",
      operationIdLabel: "—",
      description: "No description provided.",
      schemaLabel: "—",
      streamingLabel: "Batch",
      streamingTone: "neutral",
    });
  });

  it("uses the operation id as the title when the title is blank", () => {
    const identity = operationOverviewIdentity(overview({ title: "  " }));
    expect(identity.titleLabel).toBe("text-to-image");
  });
});

describe("operationOverviewStatRows", () => {
  it("returns four stable shape counters", () => {
    const rows = operationOverviewStatRows(overview());
    expect(rows.map((row) => row.key)).toEqual(["settings", "input", "output", "providers"]);
    expect(rows.map((row) => row.value)).toEqual(["3", "2", "1", "2"]);
  });

  it("is zero-filled for a missing snapshot", () => {
    expect(operationOverviewStatRows(undefined).map((row) => row.value)).toEqual(["0", "0", "0", "0"]);
  });
});

describe("operationOverviewTypesLabel / operationOverviewSettingKeysLabel", () => {
  it("humanizes known and unknown asset types", () => {
    expect(operationOverviewTypesLabel(["image", "model3d", "custom-type"])).toBe(
      "Image, Model 3D, Custom Type",
    );
  });

  it("returns None / — for empty type and key lists", () => {
    expect(operationOverviewTypesLabel(undefined)).toBe("None");
    expect(operationOverviewTypesLabel([])).toBe("None");
    expect(operationOverviewSettingKeysLabel(undefined)).toBe("—");
    expect(operationOverviewSettingKeysLabel([])).toBe("—");
  });

  it("joins non-empty setting keys", () => {
    expect(operationOverviewSettingKeysLabel(["steps", "", "seed"])).toBe("steps, seed");
  });
});

describe("operationOverviewBindingRows", () => {
  it("projects bindings into deterministic, provider-id-sorted rows", () => {
    const rows = operationOverviewBindingRows(overview());
    expect(rows.map((row) => row.providerId)).toEqual(["cloud-render", "local-comfyui"]);
    expect(rows[0]).toMatchObject({
      nameLabel: "Cloud Render",
      locationLabel: "Cloud",
      statusLabel: "Degraded",
      statusTone: "warning",
      advertisedLabel: "1.0",
      schemaLabel: "Match",
      schemaTone: "success",
      drift: false,
    });
    expect(rows[1]).toMatchObject({
      statusLabel: "Available",
      statusTone: "success",
      advertisedLabel: "1.0, 2.0",
      schemaLabel: "Drift",
      schemaTone: "warning",
      drift: true,
    });
  });

  it("uses render-safe fallbacks for a binding with missing fields", () => {
    const rows = operationOverviewBindingRows(
      overview({
        provider_bindings: [
          {
            provider_id: "",
            name: "  ",
            schema_match: true,
          } as OperationProviderBinding,
        ],
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      nameLabel: "Unknown provider",
      locationLabel: "Unknown",
      statusLabel: "Unknown",
      statusTone: "neutral",
      advertisedLabel: "—",
    });
  });

  it("returns no rows for a missing snapshot", () => {
    expect(operationOverviewBindingRows(undefined)).toEqual([]);
  });
});

describe("operationOverviewDeclaredProviderIds / operationOverviewUnboundProviderIds", () => {
  it("sorts and deduplicates declared provider ids", () => {
    const ids = operationOverviewDeclaredProviderIds(
      overview({ provider_ids: ["z", "a", "z", "", "m"] }),
    );
    expect(ids).toEqual(["a", "m", "z"]);
  });

  it("reports declared providers with no binding", () => {
    expect(operationOverviewUnboundProviderIds(overview())).toEqual(["retired-provider"]);
  });

  it("reports nothing unbound when every declared provider is bound", () => {
    expect(
      operationOverviewUnboundProviderIds(
        overview({ provider_ids: ["local-comfyui", "cloud-render"] }),
      ),
    ).toEqual([]);
  });
});

describe("operationOverviewSchemaMatchCount / operationOverviewCoverage", () => {
  it("counts schema-matching bindings and derives coverage", () => {
    expect(operationOverviewSchemaMatchCount(overview())).toBe(1);
    expect(operationOverviewCoverage(overview())).toEqual({
      matched: 1,
      total: 2,
      fraction: 0.5,
      percent: 50,
    });
  });

  it("is zero-filled for a missing snapshot", () => {
    expect(operationOverviewCoverage(undefined)).toEqual({
      matched: 0,
      total: 0,
      fraction: 0,
      percent: 0,
    });
  });

  it("reports full coverage when all bindings match", () => {
    const allMatch = overview({
      provider_bindings: overview().provider_bindings?.map((binding) => ({
        ...binding,
        schema_match: true,
      })),
    });
    expect(operationOverviewCoverage(allMatch)).toEqual({
      matched: 2,
      total: 2,
      fraction: 1,
      percent: 100,
    });
  });
});

describe("hasOperationOverviewData / operationOverviewSummaryLabel", () => {
  it("detects populated vs empty snapshots", () => {
    expect(hasOperationOverviewData(overview())).toBe(true);
    expect(hasOperationOverviewData(emptyOverview())).toBe(false);
    expect(hasOperationOverviewData(undefined)).toBe(false);
  });

  it("derives a one-line summary", () => {
    expect(operationOverviewSummaryLabel(overview())).toBe("3 settings · 1/2 schema matches");
    expect(operationOverviewSummaryLabel(undefined)).toBe("");
  });
});
