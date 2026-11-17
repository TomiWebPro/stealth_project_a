import { describe, expect, it } from "vitest";
import type { Asset } from "../../lib/types";
import {
  assetParentsLabel,
  buildLineageStages,
  lineageChainSummary,
  provenanceSummary,
} from "./helpers";

function asset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: "p1",
    type: "image",
    name: id,
    creator_id: "u1",
    storage: { key: `Assets/${id}.png`, size_bytes: 1, content_type: "image/png" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("lineage view-model helpers", () => {
  it("reports the empty lineage state", () => {
    expect(buildLineageStages([])).toEqual([]);
    expect(lineageChainSummary([])).toBe("No lineage data");
  });

  it("builds ordered stages from a full design -> video chain", () => {
    const stages = buildLineageStages([
      asset("video", { type: "video" }),
      asset("frame", { provenance: { operation_id: "frame-generation" } }),
      asset("dataset", { type: "dataset" }),
      asset("lora", { type: "lora" }),
      asset("design"),
      asset("camera", { type: "scene" }),
    ]);
    expect(stages.map((stage) => stage.label)).toEqual([
      "Design",
      "Dataset",
      "LoRA",
      "Frames",
      "Video",
      "Other",
    ]);
    expect(lineageChainSummary(stages)).toBe(
      "Design → Dataset → LoRA → Frames → Video → Other",
    );
  });

  it("does not invent stages that are absent from the data", () => {
    const stages = buildLineageStages([asset("design"), asset("dataset", { type: "dataset" })]);
    expect(stages.map((stage) => stage.key)).toEqual(["design", "dataset"]);
  });

  it("labels parents by name with graceful fallbacks", () => {
    const byId = new Map<string, Asset>([
      ["p1", asset("p1", { name: "Concept" })],
    ]);
    expect(assetParentsLabel(asset("child"), byId)).toBe("No parents");
    expect(assetParentsLabel(asset("child", { parent_asset_ids: ["p1", "missing-id"] }), byId)).toBe(
      "Concept, missing-",
    );
  });

  it("summarizes provenance with empty and populated states", () => {
    expect(provenanceSummary(asset("a"))).toBe("No provenance");
    expect(provenanceSummary(asset("a", { provenance: {} }))).toBe("Provenance recorded");
    expect(
      provenanceSummary(
        asset("a", {
          provenance: {
            operation_id: "frame-generation",
            provider_id: "comfy",
            prompt: "hero shot",
          },
        }),
      ),
    ).toBe('frame-generation · via comfy · "hero shot"');
  });
});
