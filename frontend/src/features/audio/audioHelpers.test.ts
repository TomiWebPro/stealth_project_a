import { describe, expect, it } from "vitest";
import type { CapabilityMatch } from "../../lib/catalog";
import { deriveAudioCapability, parseDialogueScript } from "./audioHelpers";

function match(operationId: string, status: CapabilityMatch["status"] = "available"): CapabilityMatch {
  return {
    provider_id: "p1",
    provider_name: "Provider One",
    location: "cloud",
    status,
    operation_id: operationId,
    schema_versions: ["v1"],
  };
}

describe("audio helpers", () => {
  it("stays disabled with no audio operations", () => {
    const capability = deriveAudioCapability([match("text-to-image")]);
    expect(capability.enabled).toBe(false);
    expect(capability.label).toContain("No audio capability");
  });

  it("enables only when an available provider advertises audio", () => {
    const capability = deriveAudioCapability([
      match("text-to-speech"),
      match("dialogue", "degraded"),
    ]);
    expect(capability.enabled).toBe(true);
    expect(capability.operationIds).toEqual(["dialogue", "text-to-speech"]);
    expect(capability.providers).toEqual(["Provider One"]);
  });

  it("parses dialogue with explicit speakers and a narrator fallback", () => {
    const lines = parseDialogueScript("Mara: Hello\nNarrator text\n\nDirector: Cut");
    expect(lines.map((line) => line.speaker)).toEqual(["Mara", "Narrator", "Director"]);
    expect(lines[1]?.text).toBe("Narrator text");
  });
});
