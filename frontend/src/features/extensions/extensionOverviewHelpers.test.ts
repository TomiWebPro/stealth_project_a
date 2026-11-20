import { describe, expect, it } from "vitest";
import type { Extension, ExtensionOverview } from "../../lib/types";
import {
  extensionOverviewCounts,
  extensionOverviewGeneratedAtLabel,
  extensionOverviewIdentity,
  extensionOverviewInstalledLabel,
  extensionOverviewName,
  extensionOverviewOptionLabel,
  extensionOverviewOptionValue,
  extensionOverviewRelativeLabel,
  extensionOverviewScopeGroups,
  extensionOverviewScopeTotal,
  extensionOverviewShortId,
  extensionOverviewStatRows,
  extensionOverviewSummaryLabel,
  hasExtensionOverviewData,
} from "./extensionOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function overview(overrides: Partial<ExtensionOverview> = {}): ExtensionOverview {
  return {
    extension_id: "11111111-2222-4333-8444-555555555555",
    manifest_id: "my-studio-connector",
    name: "My Connector",
    version: "1.2.0",
    publisher: "Example Labs",
    type: "provider",
    status: "enabled",
    installed_at: "2026-01-01T00:30:00Z",
    runtime: "node20",
    app_versions: ">=0.1.0",
    signed: true,
    verified: true,
    permissions: ["jobs.submit", "assets.read", "  "],
    capabilities: ["text-to-image", "text-to-video"],
    provider_ids: ["comfy-local", "runpod"],
    ui_contributions: ["asset.inspector"],
    dependencies: [],
    counts: {
      permissions: 3,
      capabilities: 2,
      provider_ids: 2,
      ui_contributions: 1,
      dependencies: 0,
    },
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function emptyOverview(): ExtensionOverview {
  return overview({
    permissions: [],
    capabilities: [],
    provider_ids: [],
    ui_contributions: [],
    dependencies: [],
    counts: {
      permissions: 0,
      capabilities: 0,
      provider_ids: 0,
      ui_contributions: 0,
      dependencies: 0,
    },
  });
}

function extension(overrides: Partial<Extension["manifest"]> = {}): Extension {
  return {
    manifest: {
      id: "my-studio-connector",
      name: "My Connector",
      version: "1.2.0",
      publisher: "Example Labs",
      type: "provider",
      ...overrides,
    } as Extension["manifest"],
    status: "enabled",
  } as Extension;
}

describe("extensionOverview formatters", () => {
  it("formats relative labels defensively", () => {
    expect(extensionOverviewRelativeLabel(null)).toBe("");
    expect(extensionOverviewRelativeLabel(undefined)).toBe("");
    expect(extensionOverviewRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(extensionOverviewRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("formats generated-at and installed-at footer labels", () => {
    expect(extensionOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
    expect(extensionOverviewInstalledLabel(overview(), NOW)).toBe("30 minutes ago");
    expect(extensionOverviewGeneratedAtLabel(undefined)).toBe("");
    expect(extensionOverviewInstalledLabel(undefined)).toBe("");
    expect(extensionOverviewInstalledLabel(overview({ installed_at: null }))).toBe("");
  });

  it("derives defensive short-id and name labels", () => {
    expect(extensionOverviewShortId("11111111-2222-4333-8444-555555555555")).toBe("11111111…");
    expect(extensionOverviewShortId("short")).toBe("short");
    expect(extensionOverviewShortId(undefined)).toBe("—");
    expect(extensionOverviewName(overview())).toBe("My Connector");
    expect(extensionOverviewName(overview({ name: "  ", manifest_id: "fallback-id" }))).toBe(
      "fallback-id",
    );
    expect(extensionOverviewName(overview({ name: "  ", manifest_id: "" }))).toBe(
      "Unknown extension",
    );
    expect(extensionOverviewName(undefined)).toBe("Unknown extension");
  });

  it("builds picker labels from the manifest name and id", () => {
    expect(extensionOverviewOptionLabel(extension())).toBe(
      "My Connector · my-studio-connector",
    );
    expect(extensionOverviewOptionLabel(extension({ name: "  ", id: "p1" }))).toBe(
      "Unnamed extension · p1",
    );
    expect(extensionOverviewOptionLabel(extension({ id: "" }))).toBe("My Connector");
  });

  it("derives a stable uuid-shaped option value from the manifest id", () => {
    const value = extensionOverviewOptionValue(extension());
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(extensionOverviewOptionValue(extension())).toBe(value);
    expect(extensionOverviewOptionValue(extension({ id: "another-id" }))).not.toBe(value);
  });

  it("zero-fills malformed coverage counts", () => {
    expect(extensionOverviewCounts(overview())).toEqual({
      permissions: 3,
      capabilities: 2,
      providerIds: 2,
      uiContributions: 1,
      dependencies: 0,
    });
    expect(
      extensionOverviewCounts(overview({ counts: {} as ExtensionOverview["counts"] })),
    ).toEqual({
      permissions: 0,
      capabilities: 0,
      providerIds: 0,
      uiContributions: 0,
      dependencies: 0,
    });
    expect(
      extensionOverviewCounts(
        overview({
          counts: {
            permissions: -1,
            capabilities: -2,
            provider_ids: -3,
            ui_contributions: -4,
            dependencies: -5,
          },
        }),
      ),
    ).toEqual({
      permissions: 0,
      capabilities: 0,
      providerIds: 0,
      uiContributions: 0,
      dependencies: 0,
    });
    expect(extensionOverviewCounts(undefined).permissions).toBe(0);
  });
});

describe("extensionOverviewIdentity", () => {
  it("derives identity, type/status and trust for a populated snapshot", () => {
    expect(extensionOverviewIdentity(overview())).toEqual({
      nameLabel: "My Connector",
      publisherVersionLabel: "Example Labs · v1.2.0",
      manifestIdLabel: "my-studio-connector",
      shortIdLabel: "11111111…",
      typeLabel: "Provider",
      typeTone: "accent",
      statusLabel: "Enabled",
      statusTone: "success",
      trustLabel: "signed · verified",
      trustTone: "success",
      runtimeLabel: "node20",
    });
  });

  it("marks partially-trusted and untrusted extensions as unverified", () => {
    expect(extensionOverviewIdentity(overview({ signed: true, verified: false }))).toMatchObject({
      trustLabel: "unverified",
      trustTone: "warning",
    });
    expect(extensionOverviewIdentity(overview({ signed: false, verified: true }))).toMatchObject({
      trustLabel: "unverified",
      trustTone: "warning",
    });
  });

  it("reuses shared status tones and is defensive for a missing snapshot", () => {
    expect(extensionOverviewIdentity(overview({ status: "disabled" }))).toMatchObject({
      statusLabel: "Disabled",
      statusTone: "neutral",
    });
    expect(extensionOverviewIdentity(overview({ status: "update_available" }))).toMatchObject({
      statusLabel: "Update Available",
      statusTone: "warning",
    });
    expect(extensionOverviewIdentity(undefined)).toMatchObject({
      nameLabel: "Unknown extension",
      publisherVersionLabel: "Unknown publisher · —",
      manifestIdLabel: "—",
      shortIdLabel: "—",
      typeLabel: "Unknown",
      typeTone: "neutral",
      statusLabel: "Unknown",
      statusTone: "neutral",
      trustLabel: "unverified",
      trustTone: "warning",
      runtimeLabel: "—",
    });
  });
});

describe("extensionOverviewStatRows", () => {
  it("derives the five headline counters in a stable order", () => {
    const rows = extensionOverviewStatRows(overview());
    expect(rows.map((row) => row.key)).toEqual([
      "permissions",
      "capabilities",
      "providers",
      "ui",
      "dependencies",
    ]);
    expect(rows.map((row) => row.value)).toEqual(["3", "2", "2", "1", "0"]);
    expect(rows.every((row) => row.label && row.hint)).toBe(true);
  });

  it("zero-fills every counter when the snapshot is absent", () => {
    expect(extensionOverviewStatRows(undefined).map((row) => row.value)).toEqual([
      "0",
      "0",
      "0",
      "0",
      "0",
    ]);
  });
});

describe("extensionOverview scope helpers", () => {
  it("projects scope lists into labeled groups and filters blank values", () => {
    const groups = extensionOverviewScopeGroups(overview());
    expect(groups.map((group) => group.key)).toEqual([
      "permissions",
      "capabilities",
      "providers",
      "ui",
      "dependencies",
    ]);
    expect(groups[0]?.values).toEqual(["jobs.submit", "assets.read"]);
    expect(groups[1]?.values).toEqual(["text-to-image", "text-to-video"]);
    expect(groups[4]?.values).toEqual([]);
    expect(extensionOverviewScopeTotal(overview())).toBe(7);
    expect(extensionOverviewScopeGroups(undefined).every((group) => group.values.length === 0)).toBe(
      true,
    );
  });

  it("detects snapshots with no declared scope at all", () => {
    expect(hasExtensionOverviewData(undefined)).toBe(false);
    expect(hasExtensionOverviewData(emptyOverview())).toBe(false);
    expect(hasExtensionOverviewData(overview())).toBe(true);
    // Emitted lists alone (even with zeroed counts) count as data.
    expect(
      hasExtensionOverviewData(overview({ counts: emptyOverview().counts })),
    ).toBe(true);
  });

  it("summarizes declaration counts", () => {
    expect(extensionOverviewSummaryLabel(overview())).toBe(
      "3 permissions · 2 capabilities · 2 providers",
    );
    expect(extensionOverviewSummaryLabel(emptyOverview())).toBe(
      "0 permissions · 0 capabilities · 0 providers",
    );
    expect(extensionOverviewSummaryLabel(undefined)).toBe("");
  });
});
