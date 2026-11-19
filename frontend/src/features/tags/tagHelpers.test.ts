import { describe, expect, it } from "vitest";
import type { TagIndex } from "../../lib/types";
import {
  TAG_LIMITS,
  buildTagOptions,
  tagEmptyDescription,
  tagFacetItems,
  tagIndexSummary,
} from "./tagHelpers";

const index = (tags: TagIndex["tags"], total = tags?.length ?? 0): TagIndex => ({
  tags: tags ? [...tags] : undefined,
  total,
});

describe("tag facet display helpers (C36 screens follow-up)", () => {
  it("treats a missing, tagless or absent-tags index as no rows", () => {
    expect(tagFacetItems(undefined)).toEqual([]);
    expect(tagFacetItems(index([]))).toEqual([]);
    expect(tagFacetItems({ total: 3 })).toEqual([]);
  });

  it("maps facets to render-ready rows most-used-first with share and counts", () => {
    const items = tagFacetItems(
      index([
        { name: "hero", count: 8 },
        { name: "lora", count: 4 },
        { name: "shot", count: 2 },
      ]),
    );
    expect(items.map((item) => item.name)).toEqual(["hero", "lora", "shot"]);
    expect(items.map((item) => item.countLabel)).toEqual([
      "8 assets",
      "4 assets",
      "2 assets",
    ]);
    expect(items.map((item) => item.sharePercent)).toEqual([100, 50, 25]);
    expect(items.map((item) => item.tone)).toEqual(["accent", "info", "neutral"]);
  });

  it("re-sorts an unsorted payload and keeps a stable lexical tie-break", () => {
    const items = tagFacetItems(
      index([
        { name: "zeta", count: 1 },
        { name: "alpha", count: 3 },
        { name: "beta", count: 3 },
      ]),
    );
    expect(items.map((item) => item.name)).toEqual(["alpha", "beta", "zeta"]);
  });

  it("uses a singular count label for a single asset", () => {
    const items = tagFacetItems(index([{ name: "solo", count: 1 }]));
    expect(items[0]?.countLabel).toBe("1 asset");
  });

  it("summarizes empty, single and multiple indices and honours the untruncated total", () => {
    expect(tagIndexSummary([])).toBe("No tags indexed");
    expect(tagIndexSummary(tagFacetItems(index([{ name: "hero", count: 8 }])))).toContain(
      "1 tag · most used: hero (8 assets)",
    );
    expect(
      tagIndexSummary(tagFacetItems(index([{ name: "hero", count: 8 }, { name: "vfx", count: 1 }]))),
    ).toContain("2 tags");
    expect(
      tagIndexSummary(tagFacetItems(index([{ name: "hero", count: 8 }], 17)), 17),
    ).toContain("17 tags");
  });

  it("builds hook options from the prefix, limit and project scope", () => {
    expect(buildTagOptions("  ", 10)).toEqual({ limit: 10 });
    expect(buildTagOptions("  lora ", 25)).toEqual({ prefix: "lora", limit: 25 });
    expect(buildTagOptions("hero", 50, "project-1")).toEqual({
      prefix: "hero",
      limit: 50,
      projectId: "project-1",
    });
  });

  it("exposes count chips and filter-aware empty copy", () => {
    expect(TAG_LIMITS).toEqual([10, 25, 50]);
    expect(tagEmptyDescription("")).toContain("Tags appear here");
    expect(tagEmptyDescription(" vfx ")).toContain('prefix "vfx"');
  });
});
