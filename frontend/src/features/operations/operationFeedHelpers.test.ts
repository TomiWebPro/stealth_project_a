import { describe, expect, it } from "vitest";
import type { OperationFeed, OperationFeedItem } from "../../lib/types";
import {
  buildOperationFeedOptions,
  operationFeedDescription,
  operationFeedDisplayName,
  operationFeedEmptyDescription,
  operationFeedGeneratedAtLabel,
  operationFeedProviderLabel,
  operationFeedProviderPreview,
  operationFeedRows,
  operationFeedSettingsLabel,
  operationFeedStreamingChipLabel,
  operationFeedStreamingLabel,
  operationFeedStreamingTone,
  operationFeedSummary,
  operationFeedTypeLabel,
  OPERATION_FEED_LIMITS,
  OPERATION_FEED_STREAMING_FILTERS,
} from "./operationFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<OperationFeedItem> = {}): OperationFeedItem {
  return {
    operation_id: "image-to-image",
    title: "Image To Image",
    description: "Transform a source image with a text prompt.",
    schema_version: "1.0",
    input_types: ["image"],
    output_types: ["image"],
    settings_count: 3,
    streaming: true,
    provider_ids: ["comfy-local", "runpod-cloud"],
    provider_count: 2,
    ...overrides,
  };
}

function feed(items: readonly OperationFeedItem[], total = items.length): OperationFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("buildOperationFeedOptions", () => {
  it("omits unset filters and includes only the page size when unscoped", () => {
    expect(buildOperationFeedOptions(undefined, undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the streaming filter when provided", () => {
    expect(buildOperationFeedOptions(true, undefined, 10)).toEqual({
      streaming: true,
      limit: 10,
    });
    expect(buildOperationFeedOptions(false, undefined, 10)).toEqual({
      streaming: false,
      limit: 10,
    });
  });

  it("trims a present provider id and drops a blank one", () => {
    expect(buildOperationFeedOptions(undefined, "  comfy-local  ", 50)).toEqual({
      provider_id: "comfy-local",
      limit: 50,
    });
    expect(buildOperationFeedOptions(undefined, "   ", 50)).toEqual({ limit: 50 });
  });

  it("combines all filters", () => {
    expect(buildOperationFeedOptions(false, "runpod-cloud", 10)).toEqual({
      streaming: false,
      provider_id: "runpod-cloud",
      limit: 10,
    });
  });

  it("offers the canonical page sizes and streaming chips", () => {
    expect(OPERATION_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(OPERATION_FEED_STREAMING_FILTERS).toEqual([undefined, true, false]);
  });
});

describe("operation feed chip labels and tones", () => {
  it("labels the unfiltered and streaming chips", () => {
    expect(operationFeedStreamingChipLabel(undefined)).toBe("All");
    expect(operationFeedStreamingChipLabel(true)).toBe("Streaming");
    expect(operationFeedStreamingChipLabel(false)).toBe("Batch");
  });

  it("labels and tones the streaming capability badge", () => {
    expect(operationFeedStreamingLabel(true)).toBe("Streaming");
    expect(operationFeedStreamingLabel(false)).toBe("Batch");
    expect(operationFeedStreamingTone(true)).toBe("accent");
    expect(operationFeedStreamingTone(false)).toBe("neutral");
  });
});

describe("operationFeedDisplayName / operationFeedDescription", () => {
  it("prefers the friendly title and falls back to the operation id", () => {
    expect(operationFeedDisplayName(item())).toBe("Image To Image");
    expect(operationFeedDisplayName(item({ title: "  " }))).toBe("image-to-image");
  });

  it("uses the description and falls back for blank copy", () => {
    expect(operationFeedDescription(item())).toBe("Transform a source image with a text prompt.");
    expect(operationFeedDescription(item({ description: null }))).toBe("No description provided.");
    expect(operationFeedDescription(item({ description: "  " }))).toBe("No description provided.");
  });
});

describe("operationFeed count and type labels", () => {
  it("pluralizes present counts and tolerates missing ones", () => {
    expect(operationFeedSettingsLabel(1)).toBe("1 setting");
    expect(operationFeedSettingsLabel(3)).toBe("3 settings");
    expect(operationFeedSettingsLabel(0)).toBe("No settings");
    expect(operationFeedSettingsLabel(undefined)).toBe("No settings");
    expect(operationFeedProviderLabel(1)).toBe("1 provider");
    expect(operationFeedProviderLabel(2)).toBe("2 providers");
    expect(operationFeedProviderLabel(0)).toBe("No provider");
  });

  it("humanizes asset types and handles empty sides", () => {
    expect(operationFeedTypeLabel(["image", "model3d"])).toBe("Image, Model 3D");
    expect(operationFeedTypeLabel([])).toBe("None");
    expect(operationFeedTypeLabel(undefined)).toBe("None");
  });

  it("previews provider bindings and appends a remainder count", () => {
    expect(operationFeedProviderPreview(["comfy-local", "runpod-cloud"])).toBe(
      "comfy-local, runpod-cloud",
    );
    expect(operationFeedProviderPreview(["a", "b", "c", "d"])).toBe("a, b, c +1 more");
    expect(operationFeedProviderPreview([])).toBe("Unbound");
    expect(operationFeedProviderPreview(undefined)).toBe("Unbound");
  });
});

describe("operationFeedRows", () => {
  it("returns an empty list for an unset or failed feed", () => {
    expect(operationFeedRows(undefined)).toEqual([]);
    expect(operationFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" })).toEqual([]);
  });

  it("derives render-ready rows while preserving the wire order", () => {
    const rows = operationFeedRows(
      feed([
        item(),
        item({
          operation_id: "dataset-prep",
          title: "Dataset Prep",
          description: null,
          schema_version: "0.9",
          input_types: [],
          output_types: ["dataset"],
          settings_count: 0,
          streaming: false,
          provider_ids: [],
          provider_count: 0,
        }),
      ]),
    );

    expect(rows.map((row) => row.id)).toEqual(["image-to-image", "dataset-prep"]);
    expect(rows[0]).toMatchObject({
      title: "Image To Image",
      versionLabel: "v1.0",
      inputLabel: "In: Image",
      outputLabel: "Out: Image",
      settingsLabel: "3 settings",
      streamingLabel: "Streaming",
      streamingTone: "accent",
      providerLabel: "2 providers",
      providerPreview: "comfy-local, runpod-cloud",
    });
    expect(rows[1]).toMatchObject({
      description: "No description provided.",
      versionLabel: "v0.9",
      inputLabel: "In: None",
      outputLabel: "Out: Dataset",
      settingsLabel: "No settings",
      streamingLabel: "Batch",
      streamingTone: "neutral",
      providerLabel: "No provider",
      providerPreview: "Unbound",
    });
  });
});

describe("operationFeedSummary / operationFeedGeneratedAtLabel", () => {
  it("describes an empty feed", () => {
    expect(operationFeedSummary([], 0)).toBe("No operations in this feed");
  });

  it("uses the untruncated total and the streaming count", () => {
    const rows = operationFeedRows(
      feed([item(), item({ operation_id: "dataset-prep", streaming: false })], 7),
    );
    expect(operationFeedSummary(rows, 7)).toBe("7 operations · 1 streaming");
    expect(operationFeedSummary(rows)).toBe("2 operations · 1 streaming");
  });

  it("describes a single operation", () => {
    expect(operationFeedSummary(operationFeedRows(feed([item()])))).toBe(
      "1 operation · 1 streaming",
    );
  });

  it("formats the generated-at footer and handles a missing timestamp", () => {
    expect(operationFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
    expect(operationFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("operationFeedEmptyDescription", () => {
  it("distinguishes filtered and unfiltered empty states", () => {
    expect(operationFeedEmptyDescription(false)).toContain("authoritative catalog");
    expect(operationFeedEmptyDescription(true)).toContain("Try a different streaming mode or provider");
  });
});
