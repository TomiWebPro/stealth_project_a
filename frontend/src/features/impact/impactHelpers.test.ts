import { describe, expect, it } from "vitest";
import type { Asset, AssetImpact } from "../../lib/types";
import {
  IMPACT_DEPTH_CHIPS,
  buildImpactOptions,
  impactDepthLabel,
  impactEmptyDescription,
  impactRows,
  impactSummary,
  relationshipLabel,
} from "./impactHelpers";

const asset = (id: string, name: string): Asset =>
  ({ id, name, type: "image" }) as Asset;

const impact = (nodes: AssetImpact["descendants"], total = nodes?.length ?? 0): AssetImpact => ({
  root_asset_id: "root",
  descendants: nodes ? [...nodes] : undefined,
  total,
});

describe("downstream asset impact display helpers (C37 screens follow-up)", () => {
  it("treats a missing, empty or absent-descendants impact as no rows", () => {
    expect(impactRows(undefined)).toEqual([]);
    expect(impactRows(impact([]))).toEqual([]);
    expect(impactRows({ root_asset_id: "root", total: 3 })).toEqual([]);
  });

  it("maps descendants to render-ready rows in breadth-first order", () => {
    const rows = impactRows(
      impact([
        { asset_id: "a", relationship: "derived_from", depth: 1 },
        { asset_id: "b", relationship: "variant_of", depth: 2 },
        { asset_id: "c", relationship: null, depth: 3 },
      ]),
    );
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(rows.map((row) => row.depthLabel)).toEqual(["Direct", "Depth 2", "Depth 3"]);
    expect(rows.map((row) => row.relationshipLabel)).toEqual([
      "Derived from",
      "Variant of",
      "Related",
    ]);
    expect(rows.map((row) => row.tone)).toEqual(["accent", "info", "neutral"]);
  });

  it("resolves names from sibling assets and falls back to a compact id", () => {
    const rows = impactRows(
      impact([{ asset_id: "a", depth: 1 }, { asset_id: "12345678-aaaa-bbbb-cccc-1234567890ab", depth: 2 }]),
      [asset("a", "Hero frame")],
    );
    expect(rows[0]?.label).toBe("Hero frame");
    expect(rows[1]?.label).toBe("12345678…");
  });

  it("derives safe depth and relationship labels for missing values", () => {
    expect(impactDepthLabel(1)).toBe("Direct");
    expect(impactDepthLabel(4)).toBe("Depth 4");
    expect(impactDepthLabel(0)).toBe("Direct");
    expect(impactDepthLabel(Number.NaN)).toBe("Direct");
    expect(relationshipLabel(undefined)).toBe("Related");
    expect(relationshipLabel(null)).toBe("Related");
    expect(relationshipLabel("uses_input")).toBe("Uses input");
  });

  it("summarizes empty and populated impacts and honours the untruncated total", () => {
    expect(impactSummary(undefined, [])).toBe("No downstream assets");
    const rows = impactRows(impact([{ asset_id: "a", depth: 1 }, { asset_id: "b", depth: 4 }], 9));
    expect(impactSummary(impact(undefined, 9), rows)).toContain("9 downstream assets · max depth 4");
    expect(
      impactSummary(undefined, impactRows(impact([{ asset_id: "a", depth: 1 }]))),
    ).toContain("1 downstream asset · max depth 1");
  });

  it("builds hook options and exposes depth chips and empty copy", () => {
    expect(IMPACT_DEPTH_CHIPS).toEqual([1, 2, 5, 10]);
    expect(buildImpactOptions(0)).toBeUndefined();
    expect(buildImpactOptions(5)).toEqual({ maxDepth: 5 });
    expect(impactEmptyDescription()).toContain("No assets are derived");
  });
});
