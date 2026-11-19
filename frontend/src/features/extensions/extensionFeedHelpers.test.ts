import { describe, expect, it } from "vitest";
import type { ExtensionFeed, ExtensionFeedItem } from "../../lib/types";
import {
  buildExtensionFeedOptions,
  extensionFeedDisplayName,
  extensionFeedEmptyDescription,
  extensionFeedGeneratedAtLabel,
  extensionFeedRows,
  extensionFeedStatusChipLabel,
  extensionFeedStatusTone,
  extensionFeedSummary,
  extensionFeedTrust,
  extensionFeedTypeChipLabel,
  extensionFeedTypeTone,
  extensionFeedVersionLabel,
  EXTENSION_FEED_LIMITS,
  EXTENSION_FEED_STATUS_FILTERS,
  EXTENSION_FEED_TYPE_FILTERS,
} from "./extensionFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<ExtensionFeedItem> = {}): ExtensionFeedItem {
  return {
    extension_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    manifest_id: "studio-comfy-connector",
    name: "Comfy Connector",
    version: "1.2.0",
    publisher: "Example Labs",
    type: "provider",
    status: "enabled",
    signed: true,
    verified: true,
    installed_at: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function feed(items: readonly ExtensionFeedItem[], total = items.length): ExtensionFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("buildExtensionFeedOptions", () => {
  it("omits both filters when unscoped", () => {
    expect(buildExtensionFeedOptions(undefined, undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the type and status filters when provided", () => {
    expect(buildExtensionFeedOptions("provider", "enabled", 10)).toEqual({
      type: "provider",
      status: "enabled",
      limit: 10,
    });
  });

  it("offers the canonical page sizes and filter chips", () => {
    expect(EXTENSION_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(EXTENSION_FEED_TYPE_FILTERS).toEqual([
      undefined,
      "capability",
      "ui",
      "provider",
      "runtime",
      "bundle",
    ]);
    expect(EXTENSION_FEED_STATUS_FILTERS).toEqual([
      undefined,
      "installed",
      "enabled",
      "disabled",
      "update_available",
    ]);
  });
});

describe("extension feed chip labels and tones", () => {
  it("labels the unfiltered chips and canonical types/statuses", () => {
    expect(extensionFeedTypeChipLabel(undefined)).toBe("All");
    expect(extensionFeedTypeChipLabel("ui")).toBe("UI");
    expect(extensionFeedTypeChipLabel("provider")).toBe("Provider");
    expect(extensionFeedStatusChipLabel(undefined)).toBe("All");
    expect(extensionFeedStatusChipLabel("enabled")).toBe("Enabled");
    expect(extensionFeedStatusChipLabel("update_available")).toBe("Update Available");
  });

  it("maps canonical types and installation statuses to badge tones", () => {
    expect(extensionFeedTypeTone("capability")).toBe("accent");
    expect(extensionFeedTypeTone("bundle")).toBe("neutral");
    expect(extensionFeedStatusTone("enabled")).toBe("success");
    expect(extensionFeedStatusTone("installed")).toBe("info");
    expect(extensionFeedStatusTone("disabled")).toBe("neutral");
    expect(extensionFeedStatusTone("update_available")).toBe("warning");
  });
});

describe("extensionFeedDisplayName / extensionFeedVersionLabel", () => {
  it("prefers the friendly name, then the manifest id, then a short extension id", () => {
    expect(extensionFeedDisplayName(item())).toBe("Comfy Connector");
    expect(extensionFeedDisplayName(item({ name: "  ", manifest_id: "manifest-id" }))).toBe(
      "manifest-id",
    );
    expect(
      extensionFeedDisplayName(
        item({ name: "", manifest_id: "", extension_id: "abcdefgh-1111-4111-8111-abcdefghijkl" }),
      ),
    ).toBe("abcdefgh…");
    expect(
      extensionFeedDisplayName(item({ name: "", manifest_id: "", extension_id: "short" })),
    ).toBe("short");
  });

  it("prefixes a present version and tolerates a missing one", () => {
    expect(extensionFeedVersionLabel("1.2.0")).toBe("v1.2.0");
    expect(extensionFeedVersionLabel(undefined)).toBe("—");
    expect(extensionFeedVersionLabel("  ")).toBe("—");
  });
});

describe("extensionFeedTrust", () => {
  it("treats signed AND verified as the only trusted state", () => {
    expect(extensionFeedTrust(item())).toEqual({ label: "signed · verified", tone: "success" });
    expect(extensionFeedTrust(item({ signed: true, verified: false }))).toEqual({
      label: "unverified",
      tone: "warning",
    });
    expect(extensionFeedTrust(item({ signed: false, verified: true }))).toEqual({
      label: "unverified",
      tone: "warning",
    });
    expect(extensionFeedTrust(item({ signed: false, verified: false }))).toEqual({
      label: "unverified",
      tone: "warning",
    });
  });
});

describe("extensionFeedRows", () => {
  it("returns an empty list for an unset or failed feed", () => {
    expect(extensionFeedRows(undefined, NOW)).toEqual([]);
    expect(extensionFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" }, NOW)).toEqual([]);
  });

  it("derives render-ready rows while preserving newest-first order", () => {
    const rows = extensionFeedRows(
      feed([
        item(),
        item({
          extension_id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
          manifest_id: "scene-exporter",
          name: "Scene Exporter",
          version: "0.4",
          publisher: "Studio Labs",
          type: "capability",
          status: "update_available",
          signed: false,
          verified: false,
          installed_at: "2026-01-01T00:20:00Z",
        }),
      ]),
      NOW,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([
      "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
    ]);
    expect(rows[0]).toMatchObject({
      name: "Comfy Connector",
      manifestId: "studio-comfy-connector",
      versionLabel: "v1.2.0",
      publisher: "Example Labs",
      type: "provider",
      typeLabel: "Provider",
      typeTone: "accent",
      status: "enabled",
      statusLabel: "Enabled",
      statusTone: "success",
      trustLabel: "signed · verified",
      trustTone: "success",
      timestamp: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      type: "capability",
      typeLabel: "Capability",
      statusLabel: "Update Available",
      statusTone: "warning",
      trustLabel: "unverified",
      trustTone: "warning",
    });
  });
});

describe("extensionFeedSummary", () => {
  it("describes an empty feed", () => {
    expect(extensionFeedSummary([], 0)).toBe("No installed extensions");
  });

  it("uses the untruncated total and the newest installation name", () => {
    const rows = extensionFeedRows(feed([item()]), NOW);
    expect(extensionFeedSummary(rows, 99)).toBe("99 extensions · latest: Comfy Connector");
    expect(extensionFeedSummary(rows)).toBe("1 extension · latest: Comfy Connector");
  });
});

describe("extensionFeedGeneratedAtLabel", () => {
  it("is empty when absent and relative when present", () => {
    expect(extensionFeedGeneratedAtLabel(undefined, NOW)).toBe("");
    expect(extensionFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
  });
});

describe("extensionFeedEmptyDescription", () => {
  it("is filter-aware", () => {
    expect(extensionFeedEmptyDescription(true)).toContain("filters");
    expect(extensionFeedEmptyDescription(false)).toContain("Installed connectors");
  });
});
