import { describe, expect, it } from "vitest";
import type { Extension } from "../../lib/types";
import { buildExtensionCards, extensionSummary, SDK_EXAMPLES } from "./helpers";

function ext(overrides: Partial<Extension> = {}): Extension {
  return {
    manifest: {
      id: "ext-1",
      name: "Example",
      version: "1.0.0",
      publisher: "Labs",
      type: "provider",
      requirements: {
        app_versions: ">=0.1.0",
        permissions: [{ name: "jobs.submit" }],
        capabilities: ["text-to-image"],
      },
    },
    status: "enabled",
    signed: true,
    verified: true,
    ...overrides,
  };
}

describe("extension helpers", () => {
  it("derives display cards including permissions and trust", () => {
    const cards = buildExtensionCards([ext()]);
    expect(cards[0]).toMatchObject({
      id: "ext-1",
      status: "enabled",
      statusTone: "success",
      permissions: ["jobs.submit"],
      capabilities: ["text-to-image"],
      trusted: true,
    });
    expect(extensionSummary(cards)).toBe("1 extension · 1 enabled");
  });

  it("treats unsigned or unverified extensions as untrusted", () => {
    const cards = buildExtensionCards([ext({ signed: true, verified: false })]);
    expect(cards[0]?.trusted).toBe(false);
  });

  it("ships SDK examples as stable data", () => {
    expect(SDK_EXAMPLES.length).toBeGreaterThanOrEqual(2);
    expect(SDK_EXAMPLES.every((example) => example.code.length > 0)).toBe(true);
  });
});
