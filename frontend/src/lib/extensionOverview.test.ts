import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { extensionId } from "./extensionFeed";
import { REFERENCE_NOW } from "./mock/data";
import type { Extension } from "./types";
import { deriveExtensionOverview } from "./extensionOverview";

function extension(overrides: Partial<Extension["manifest"]> = {}, install: Partial<Extension> = {}): Extension {
  return {
    manifest: {
      id: "test-extension",
      name: "Test Extension",
      version: "1.0.0",
      publisher: "Studio Core",
      type: "capability",
      requirements: { app_versions: ">=0.1.0" },
      ...overrides,
    },
    status: "enabled",
    installed_at: REFERENCE_NOW,
    signed: true,
    verified: true,
    ...install,
  };
}

describe("deriveExtensionOverview", () => {
  it("derives a zero-filled snapshot for an extension with no declared scope", () => {
    const seeded = extension();
    expect(deriveExtensionOverview(extensionId(seeded.manifest.id), [seeded], REFERENCE_NOW)).toEqual({
      extension_id: extensionId(seeded.manifest.id),
      manifest_id: "test-extension",
      name: "Test Extension",
      version: "1.0.0",
      publisher: "Studio Core",
      type: "capability",
      status: "enabled",
      installed_at: REFERENCE_NOW,
      runtime: null,
      app_versions: ">=0.1.0",
      signed: true,
      verified: true,
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
      generated_at: REFERENCE_NOW,
    });
  });

  it("sorts and deduplicates the declared scope and counts each list", () => {
    const seeded = extension({
      requirements: {
        app_versions: ">=0.2.0",
        permissions: [
          { name: "assets.write" },
          { name: "runtime.local" },
          { name: "assets.write" },
        ],
        capabilities: ["upscale", "text-to-image", "upscale"],
        provider_ids: ["prov_b", "prov_a", "prov_b"],
        runtime: "local-python",
      },
      ui_contributions: ["panel.z", "panel.a", "panel.z"],
      dependencies: [
        { extension_id: "ext_b", version_range: ">=1.0.0" },
        { extension_id: "ext_a", version_range: ">=1.0.0" },
        { extension_id: "ext_b", version_range: ">=1.0.0" },
      ],
    }, { status: "disabled", installed_at: null, signed: false, verified: false });

    const overview = deriveExtensionOverview(extensionId(seeded.manifest.id), [seeded], REFERENCE_NOW);

    expect(overview.type).toBe("capability");
    expect(overview.status).toBe("disabled");
    expect(overview.installed_at).toBeNull();
    expect(overview.runtime).toBe("local-python");
    expect(overview.app_versions).toBe(">=0.2.0");
    expect(overview.signed).toBe(false);
    expect(overview.verified).toBe(false);
    expect(overview.permissions).toEqual(["assets.write", "runtime.local"]);
    expect(overview.capabilities).toEqual(["text-to-image", "upscale"]);
    expect(overview.provider_ids).toEqual(["prov_a", "prov_b"]);
    expect(overview.ui_contributions).toEqual(["panel.a", "panel.z"]);
    expect(overview.dependencies).toEqual(["ext_a", "ext_b"]);
    expect(overview.counts).toEqual({
      permissions: 2,
      capabilities: 2,
      provider_ids: 2,
      ui_contributions: 2,
      dependencies: 2,
    });
  });

  it("throws a normalized 404 for an unknown extension id", () => {
    expect(() => deriveExtensionOverview("missing", [], REFERENCE_NOW)).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "extension_not_found" }),
    );
    expect(() => deriveExtensionOverview("missing", [], REFERENCE_NOW)).toThrow(ApiError);
  });
});
