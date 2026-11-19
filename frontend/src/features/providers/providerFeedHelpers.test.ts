import { describe, expect, it } from "vitest";
import type { ProviderFeed, ProviderFeedItem } from "../../lib/types";
import {
  buildProviderFeedOptions,
  providerFeedCapabilityLabel,
  providerFeedDisplayName,
  providerFeedEmptyDescription,
  providerFeedGeneratedAtLabel,
  providerFeedLocationChipLabel,
  providerFeedLocationTone,
  providerFeedOperationPreview,
  providerFeedRows,
  providerFeedStatusChipLabel,
  providerFeedStatusTone,
  providerFeedSummary,
  PROVIDER_FEED_LIMITS,
  PROVIDER_FEED_LOCATION_FILTERS,
  PROVIDER_FEED_STATUS_FILTERS,
} from "./providerFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<ProviderFeedItem> = {}): ProviderFeedItem {
  return {
    provider_id: "comfy-local",
    name: "ComfyUI Local",
    location: "local",
    status: "available",
    operation_ids: ["image-to-image", "txt2img"],
    capability_count: 3,
    ...overrides,
  };
}

function feed(items: readonly ProviderFeedItem[], total = items.length): ProviderFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("buildProviderFeedOptions", () => {
  it("omits both filters when unscoped", () => {
    expect(buildProviderFeedOptions(undefined, undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the location and status filters when provided", () => {
    expect(buildProviderFeedOptions("cloud", "degraded", 10)).toEqual({
      location: "cloud",
      status: "degraded",
      limit: 10,
    });
  });

  it("offers the canonical page sizes and filter chips", () => {
    expect(PROVIDER_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(PROVIDER_FEED_LOCATION_FILTERS).toEqual([undefined, "local", "studio", "cloud"]);
    expect(PROVIDER_FEED_STATUS_FILTERS).toEqual([
      undefined,
      "available",
      "unavailable",
      "degraded",
    ]);
  });
});

describe("provider feed chip labels and tones", () => {
  it("labels the unfiltered chips and canonical locations/statuses", () => {
    expect(providerFeedLocationChipLabel(undefined)).toBe("All");
    expect(providerFeedLocationChipLabel("local")).toBe("Local");
    expect(providerFeedLocationChipLabel("studio")).toBe("Studio");
    expect(providerFeedStatusChipLabel(undefined)).toBe("All");
    expect(providerFeedStatusChipLabel("available")).toBe("Available");
    expect(providerFeedStatusChipLabel("degraded")).toBe("Degraded");
  });

  it("maps canonical locations and health statuses to badge tones", () => {
    expect(providerFeedLocationTone("local")).toBe("accent");
    expect(providerFeedLocationTone("studio")).toBe("info");
    expect(providerFeedLocationTone("cloud")).toBe("neutral");
    expect(providerFeedStatusTone("available")).toBe("success");
    expect(providerFeedStatusTone("degraded")).toBe("warning");
    expect(providerFeedStatusTone("unavailable")).toBe("danger");
  });
});

describe("providerFeedDisplayName / providerFeedCapabilityLabel", () => {
  it("prefers the friendly name and falls back to the provider id", () => {
    expect(providerFeedDisplayName(item())).toBe("ComfyUI Local");
    expect(providerFeedDisplayName(item({ name: "  " }))).toBe("comfy-local");
  });

  it("pluralizes a present capability count and tolerates a missing one", () => {
    expect(providerFeedCapabilityLabel(1)).toBe("1 capability");
    expect(providerFeedCapabilityLabel(3)).toBe("3 capabilities");
    expect(providerFeedCapabilityLabel(0)).toBe("No capabilities");
    expect(providerFeedCapabilityLabel(undefined)).toBe("No capabilities");
  });
});

describe("providerFeedOperationPreview", () => {
  it("humanizes operation ids and appends a remainder count", () => {
    expect(providerFeedOperationPreview(["image-to-image", "txt2img"])).toBe(
      "Image To Image, Txt2img",
    );
    expect(providerFeedOperationPreview(["a", "b", "c", "d"])).toBe("A, B, C +1 more");
    expect(providerFeedOperationPreview([])).toBe("No advertised operations");
    expect(providerFeedOperationPreview(undefined)).toBe("No advertised operations");
  });
});

describe("providerFeedRows", () => {
  it("returns an empty list for an unset or failed feed", () => {
    expect(providerFeedRows(undefined)).toEqual([]);
    expect(providerFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" })).toEqual([]);
  });

  it("derives render-ready rows while preserving the wire order", () => {
    const rows = providerFeedRows(
      feed([
        item(),
        item({
          provider_id: "runpod-cloud",
          name: "RunPod Cloud",
          location: "cloud",
          status: "degraded",
          operation_ids: [],
          capability_count: 0,
        }),
      ]),
    );

    expect(rows.map((row) => row.id)).toEqual(["comfy-local", "runpod-cloud"]);
    expect(rows[0]).toMatchObject({
      name: "ComfyUI Local",
      locationLabel: "Local",
      locationTone: "accent",
      statusLabel: "Available",
      statusTone: "success",
      capabilityCount: 3,
      capabilityLabel: "3 capabilities",
      operationCount: 2,
      operationPreview: "Image To Image, Txt2img",
    });
    expect(rows[1]).toMatchObject({
      locationLabel: "Cloud",
      statusLabel: "Degraded",
      statusTone: "warning",
      capabilityLabel: "No capabilities",
      operationPreview: "No advertised operations",
    });
  });

  it("tolerates a feed with no items array", () => {
    expect(providerFeedRows({ total: 0, generated_at: "2026-01-01T00:59:00Z" })).toEqual([]);
  });
});

describe("providerFeedSummary / providerFeedGeneratedAtLabel", () => {
  it("describes an empty feed", () => {
    expect(providerFeedSummary([], 0)).toBe("No providers in this feed");
  });

  it("uses the untruncated total and the summed capability count", () => {
    const rows = providerFeedRows(feed([item(), item({ provider_id: "other", capability_count: 1 })], 7));
    expect(providerFeedSummary(rows, 7)).toBe("7 providers · 4 capabilities advertised");
    expect(providerFeedSummary(rows)).toBe("2 providers · 4 capabilities advertised");
  });

  it("describes a single provider", () => {
    expect(providerFeedSummary(providerFeedRows(feed([item()])))).toBe(
      "1 provider · 3 capabilities advertised",
    );
  });

  it("formats the generated-at footer and handles a missing timestamp", () => {
    expect(providerFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
    expect(providerFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("providerFeedEmptyDescription", () => {
  it("distinguishes filtered and unfiltered empty states", () => {
    expect(providerFeedEmptyDescription(false)).toContain("authoritative registry");
    expect(providerFeedEmptyDescription(true)).toContain("Try a different location or status");
  });
});
