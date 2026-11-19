import { describe, expect, it } from "vitest";

import type { Extension, ExtensionStatus, ExtensionType } from "./types";
import {
  EXTENSION_STATUSES,
  EXTENSION_TYPES,
  deriveExtensionStats,
  extensionStatsQueryParams,
  validateExtensionStatsArgs,
} from "./extensionStats";
import { REFERENCE_NOW } from "./mock/data";

function extension(
  id: string,
  type: ExtensionType,
  status: ExtensionStatus,
  opts: {
    permissions?: readonly string[];
    capabilities?: readonly string[];
    signed?: boolean;
    verified?: boolean;
  } = {},
): Extension {
  return {
    manifest: {
      id,
      name: `extension-${id}`,
      version: "1.0.0",
      publisher: "Test",
      type,
      requirements: {
        app_versions: ">=0.1.0",
        permissions: (opts.permissions ?? []).map((name) => ({ name })),
        capabilities: [...(opts.capabilities ?? [])],
      },
    },
    status,
    signed: opts.signed,
    verified: opts.verified,
  };
}

const EXTENSIONS: readonly Extension[] = [
  extension("a", "ui", "enabled", {
    permissions: ["assets.read", "storage.write"],
    capabilities: ["splat-preview"],
    signed: true,
    verified: true,
  }),
  extension("b", "provider", "disabled", {
    permissions: ["provider.access", "assets.read"],
    capabilities: ["text-to-image", "image-to-image"],
    signed: true,
  }),
  extension("c", "capability", "installed"),
];

describe("deriveExtensionStats", () => {
  it("zero-fills every breakdown for an empty store", () => {
    expect(deriveExtensionStats([], REFERENCE_NOW)).toEqual({
      total_registered: 0,
      total_installed: 0,
      by_type: EXTENSION_TYPES.map((type) => ({ type, count: 0 })),
      by_status: EXTENSION_STATUSES.map((status) => ({ status, count: 0 })),
      enabled: 0,
      signed: 0,
      verified: 0,
      total_permissions: 0,
      unique_permissions: 0,
      by_permission: [],
      total_capabilities: 0,
      generated_at: REFERENCE_NOW,
    });
  });

  it("derives type/status breakdowns, trust flags and deterministic permission coverage", () => {
    const stats = deriveExtensionStats(EXTENSIONS, REFERENCE_NOW);

    expect(stats.total_registered).toBe(3);
    expect(stats.total_installed).toBe(3);
    expect(stats.by_type).toEqual([
      { type: "capability", count: 1 },
      { type: "ui", count: 1 },
      { type: "provider", count: 1 },
      { type: "runtime", count: 0 },
      { type: "bundle", count: 0 },
    ]);
    expect(stats.by_status).toEqual([
      { status: "installed", count: 1 },
      { status: "enabled", count: 1 },
      { status: "disabled", count: 1 },
      { status: "update_available", count: 0 },
    ]);
    expect(stats.enabled).toBe(1);
    expect(stats.signed).toBe(2);
    expect(stats.verified).toBe(1);
    expect(stats.total_permissions).toBe(4);
    expect(stats.unique_permissions).toBe(3);
    // Sorted by -extensions then name (assets.read appears twice).
    expect(stats.by_permission).toEqual([
      { permission: "assets.read", extensions: 2 },
      { permission: "provider.access", extensions: 1 },
      { permission: "storage.write", extensions: 1 },
    ]);
    expect(stats.total_capabilities).toBe(3);
    expect(stats.generated_at).toBe(REFERENCE_NOW);
  });

  it("narrows only the registry slice for a type filter", () => {
    const stats = deriveExtensionStats(EXTENSIONS, REFERENCE_NOW, { type: "ui" });
    expect(stats.total_registered).toBe(1);
    expect(stats.by_type).toEqual([
      { type: "capability", count: 0 },
      { type: "ui", count: 1 },
      { type: "provider", count: 0 },
      { type: "runtime", count: 0 },
      { type: "bundle", count: 0 },
    ]);
    expect(stats.by_permission).toEqual([
      { permission: "assets.read", extensions: 1 },
      { permission: "storage.write", extensions: 1 },
    ]);
    expect(stats.total_capabilities).toBe(1);
    // Installation metrics stay unchanged.
    expect(stats.total_installed).toBe(3);
    expect(stats.enabled).toBe(1);
  });

  it("narrows only the installation slice for a status filter", () => {
    const stats = deriveExtensionStats(EXTENSIONS, REFERENCE_NOW, { status: "enabled" });
    expect(stats.total_installed).toBe(1);
    expect(stats.enabled).toBe(1);
    expect(stats.signed).toBe(1);
    expect(stats.verified).toBe(1);
    expect(stats.by_status?.[1]).toEqual({ status: "enabled", count: 1 });
    // Registry metrics stay unchanged.
    expect(stats.total_registered).toBe(3);
    expect(stats.total_permissions).toBe(4);
  });

  it("applies both filters independently and zero-fills an empty slice", () => {
    const both = deriveExtensionStats(EXTENSIONS, REFERENCE_NOW, {
      type: "bundle",
      status: "update_available",
    });
    expect(both.total_registered).toBe(0);
    expect(both.total_installed).toBe(0);
    expect(both.by_type).toEqual(EXTENSION_TYPES.map((type) => ({ type, count: 0 })));
    expect(both.by_status).toEqual(EXTENSION_STATUSES.map((status) => ({ status, count: 0 })));
    expect(both.by_permission).toEqual([]);
  });
});

describe("validateExtensionStatsArgs", () => {
  it("rejects an invalid type with a 422 envelope", () => {
    expect(() => validateExtensionStatsArgs({ type: "mystery" as never })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "type" })],
      }),
    );
  });

  it("rejects an invalid status with a 422 envelope", () => {
    expect(() => validateExtensionStatsArgs({ status: "bogus" as never })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "status" })],
      }),
    );
  });

  it("accepts canonical values or an omitted filter", () => {
    expect(() => validateExtensionStatsArgs()).not.toThrow();
    expect(() => validateExtensionStatsArgs({ type: "ui", status: "enabled" })).not.toThrow();
  });
});

describe("extensionStatsQueryParams", () => {
  it("maps the filters to the authoritative query string", () => {
    expect(extensionStatsQueryParams()).toEqual({ type: undefined, status: undefined });
    expect(extensionStatsQueryParams({ type: "provider", status: "disabled" })).toEqual({
      type: "provider",
      status: "disabled",
    });
  });
});
