import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { Extension } from "./types";
import {
  deriveExtensionFeed,
  extensionFeedQueryParams,
  extensionId,
  validateExtensionFeedArgs,
} from "./extensionFeed";

const NOW = "2026-11-19T12:00:00Z";

function extension(
  id: string,
  overrides: Partial<Extension> = {},
  manifestOverrides: Partial<Extension["manifest"]> = {},
): Extension {
  const manifest = {
    id,
    name: `Extension ${id}`,
    version: "1.0.0",
    publisher: "Studio Core",
    type: "capability" as const,
    requirements: { app_versions: ">=0.1.0" },
    ...manifestOverrides,
  };
  return {
    manifest,
    status: "installed",
    installed_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const extensions: Extension[] = [
  extension("com.studio.older", { installed_at: "2026-01-02T00:00:00Z", signed: true }, { type: "provider" }),
  extension("com.studio.newer", { installed_at: "2026-01-05T00:00:00Z", status: "enabled", verified: true }),
  extension("com.studio.middle", { installed_at: "2026-01-03T00:00:00Z", status: "disabled" }, { type: "ui" }),
  extension("com.studio.no-time", { installed_at: null }),
];

describe("extensionId", () => {
  // Values produced by Python's uuid5(NAMESPACE_URL, "studio-extension:<id>"),
  // the backend's deterministic installation id — the pure-JS derivation must
  // match byte-for-byte so mock and live ids agree.
  it.each([
    ["comfyui-local-adapter", "f9c71eba-e91c-5724-ad4e-367cfdb0ad80"],
    ["publish-audit-sidecar", "5de7a519-d9b7-5fc0-b9d4-683b5dfd4d95"],
    ["legacy-exporter", "db910473-a963-524f-ac56-d621ffd3d8cf"],
  ])("matches the backend uuid5 for %s", (manifestId, expected) => {
    expect(extensionId(manifestId)).toBe(expected);
  });

  it("is deterministic and version/variant correct", () => {
    const id = extensionId("com.studio.newer");
    expect(extensionId("com.studio.newer")).toBe(id);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("deriveExtensionFeed", () => {
  it("projects extensions newest-first and skips documents with no install time", () => {
    const feed = deriveExtensionFeed(extensions, NOW);
    expect(feed.total).toBe(3);
    expect((feed.items ?? []).map((item) => item.manifest_id)).toEqual([
      "com.studio.newer",
      "com.studio.middle",
      "com.studio.older",
    ]);
    expect(feed.items?.[0]).toMatchObject({
      name: "Extension com.studio.newer",
      version: "1.0.0",
      publisher: "Studio Core",
      type: "capability",
      status: "enabled",
      signed: false,
      verified: true,
      installed_at: "2026-01-05T00:00:00Z",
    });
    expect(feed.items?.[0]?.extension_id).toBe(extensionId("com.studio.newer"));
    expect(feed.generated_at).toBe(NOW);
  });

  it("breaks install-time ties deterministically by extension id", () => {
    const tied = [extension("b"), extension("a")].map((value) => ({
      ...value,
      installed_at: "2026-01-05T00:00:00Z",
    }));
    const feed = deriveExtensionFeed(tied, NOW);
    const ids = (feed.items ?? []).map((item) => item.extension_id);
    expect(ids).toEqual([...ids].sort((a, b) => b.localeCompare(a)));
  });

  it("filters by type and status independently", () => {
    expect(deriveExtensionFeed(extensions, NOW, { type: "provider" }).total).toBe(1);
    expect(deriveExtensionFeed(extensions, NOW, { status: "disabled" }).total).toBe(1);
    const both = deriveExtensionFeed(extensions, NOW, { type: "ui", status: "disabled" });
    expect(both.total).toBe(1);
    expect(both.items?.[0]?.manifest_id).toBe("com.studio.middle");
    expect(deriveExtensionFeed(extensions, NOW, { type: "provider", status: "disabled" }).total).toBe(0);
  });

  it("bounds the page with a whole-scope total counted before paging", () => {
    const feed = deriveExtensionFeed(extensions, NOW, { limit: 2 });
    expect(feed.total).toBe(3);
    expect(feed.items ?? []).toHaveLength(2);
  });

  it("returns an empty feed for an empty store", () => {
    expect(deriveExtensionFeed([], NOW)).toEqual({ items: [], total: 0, generated_at: NOW });
  });
});

describe("validateExtensionFeedArgs", () => {
  it("accepts empty options and well-formed filters and limits", () => {
    expect(() => validateExtensionFeedArgs()).not.toThrow();
    expect(() =>
      validateExtensionFeedArgs({ type: "ui", status: "enabled", limit: 200 }),
    ).not.toThrow();
  });

  it("rejects an unknown type with a 422", () => {
    expect(() => validateExtensionFeedArgs({ type: "mystery" as never })).toThrowError(ApiError);
    try {
      validateExtensionFeedArgs({ type: "mystery" as never });
    } catch (cause) {
      expect(cause).toMatchObject({ status: 422, code: "validation_error" });
    }
  });

  it("rejects an unknown status with a 422", () => {
    expect(() => validateExtensionFeedArgs({ status: "bogus" as never })).toThrowError(ApiError);
  });

  it.each([0, 201, -1, 1.5])("rejects an out-of-range limit (%s) with a 422", (limit) => {
    expect(() => validateExtensionFeedArgs({ limit })).toThrowError(ApiError);
  });
});

describe("extensionFeedQueryParams", () => {
  it("maps options to the wire query string", () => {
    expect(extensionFeedQueryParams({ type: "ui", status: "enabled", limit: 5 })).toEqual({
      type: "ui",
      status: "enabled",
      limit: 5,
    });
    expect(extensionFeedQueryParams()).toEqual({
      type: undefined,
      status: undefined,
      limit: undefined,
    });
  });
});
