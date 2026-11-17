import { describe, expect, it } from "vitest";
import type { Asset } from "../../lib/types";
import {
  applyAssetEdit,
  draftFromAsset,
  draftHasChanges,
  metadataFromLines,
  metadataToLines,
  parseTagsInput,
  provenanceFields,
  tagsToInput,
} from "./detailHelpers";

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    project_id: "project-1",
    type: "image",
    name: "Concept frame",
    creator_id: "user-1",
    storage: {
      key: "Projects/Default/Assets/Char/concept.png",
      size_bytes: 1024,
      content_type: "image/png",
    },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("asset detail helpers", () => {
  it("round-trips scalar and structured metadata through editable lines", () => {
    const metadata = {
      sequence: "s01",
      count: 3,
      ready: true,
      camera_path: { points: 4 },
    };
    expect(metadataFromLines(metadataToLines(metadata))).toEqual(metadata);
  });

  it("parses tags and ignores empty segments", () => {
    expect(parseTagsInput(" character, prop ,, environment ")).toEqual([
      "character",
      "prop",
      "environment",
    ]);
    expect(tagsToInput(["character", "prop"])).toBe("character, prop");
  });

  it("merges a local edit onto the authoritative asset without mutating it", () => {
    const asset = makeAsset({ tags: ["original"] });
    const edited = applyAssetEdit(asset, { name: "Renamed", tags: ["new"] });
    expect(edited.name).toBe("Renamed");
    expect(edited.tags).toEqual(["new"]);
    expect(asset.name).toBe("Concept frame");
    expect(asset.tags).toEqual(["original"]);
  });

  it("detects edits relative to the authoritative draft", () => {
    const asset = makeAsset({ tags: ["a"], metadata: { sequence: "s01" } });
    const original = draftFromAsset(asset);
    expect(draftHasChanges({ ...original }, original)).toBe(false);
    expect(draftHasChanges({ ...original, name: "Other" }, original)).toBe(true);
    expect(
      draftHasChanges({ ...original, metadata: { sequence: "s02" } }, original),
    ).toBe(true);
  });

  it("derives provenance fields only when provenance exists", () => {
    expect(provenanceFields(makeAsset())).toEqual([]);
    const fields = provenanceFields(
      makeAsset({
        provenance: { operation_id: "image-gen", prompt: "a cat", provider_id: "comfy-local" },
      }),
    );
    expect(fields).toEqual([
      { label: "Operation", value: "image-gen" },
      { label: "Prompt", value: "a cat" },
      { label: "Provider", value: "comfy-local" },
    ]);
  });
});
