import { describe, expect, it } from "vitest";
import type { Asset } from "../../lib/types";
import { buildWorkflowTemplateCards, templateDescription } from "./helpers";

function asset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: "p1",
    type: "resource",
    name: id,
    creator_id: "u1",
    storage: { key: `Templates/${id}.json`, size_bytes: 1, content_type: "application/json" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("workflow template view-model helpers", () => {
  it("returns no cards for an empty or non-resource asset set", () => {
    expect(buildWorkflowTemplateCards([])).toEqual([]);
    expect(buildWorkflowTemplateCards([asset("img", { type: "image" })])).toEqual([]);
  });

  it("maps resource assets to sorted cards with safe tag fallback", () => {
    const cards = buildWorkflowTemplateCards([
      asset("z-template", { tags: ["video"] }),
      asset("a-template"),
    ]);
    expect(cards.map((card) => card.name)).toEqual(["a-template", "z-template"]);
    expect(cards[0]?.storageKey).toBe("Templates/a-template.json");
    expect(cards[0]?.tags).toEqual([]);
    expect(cards[1]?.tags).toEqual(["video"]);
  });

  it("uses metadata description or a neutral fallback", () => {
    expect(templateDescription(asset("a"))).toBe(
      "Workflow template asset (metadata/data reference only).",
    );
    expect(templateDescription(asset("a", { metadata: { description: "Portrait LoRA prep" } }))).toBe(
      "Portrait LoRA prep",
    );
  });
});
