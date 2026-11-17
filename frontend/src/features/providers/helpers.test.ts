import { describe, expect, it } from "vitest";
import type { Provider } from "../../lib/types";
import {
  formatCapabilitiesSummary,
  providerLocationLabel,
  providerOperationIds,
  providerStatusTone,
} from "./helpers";

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "p1",
    name: "Local ComfyUI",
    location: "local",
    status: "available",
    capabilities: [{ operation_id: "text-to-image" }, { operation_id: "img2img" }],
    ...overrides,
  };
}

describe("provider display helpers", () => {
  it("maps statuses and locations to tones/labels", () => {
    expect(providerStatusTone("available")).toBe("success");
    expect(providerStatusTone("degraded")).toBe("warning");
    expect(providerStatusTone("unavailable")).toBe("danger");
    expect(providerLocationLabel("studio")).toBe("Studio");
  });

  it("handles the empty capability state", () => {
    expect(providerOperationIds(provider({ capabilities: [] }))).toEqual([]);
    expect(formatCapabilitiesSummary(provider({ capabilities: [] }))).toBe("No capabilities reported");
  });

  it("formats populated capability summaries", () => {
    expect(providerOperationIds(provider())).toEqual(["text-to-image", "img2img"]);
    expect(formatCapabilitiesSummary(provider())).toBe("2 operations");
    expect(
      formatCapabilitiesSummary(provider({ capabilities: [{ operation_id: "tts" }] })),
    ).toBe("1 operation");
  });
});
