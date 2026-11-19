/**
 * Display models for authoritative downstream asset impact (C34/C37 follow-up).
 *
 * The backend derives every transitive descendant of an asset from its
 * relationship store; the mocks transport mirrors that breadth-first walk. This
 * module turns the canonical payload into render-ready rows so the panel JSX
 * stays free of inline mapping and both transports render identically. Every
 * helper tolerates `undefined` (query not settled / error / unknown root).
 */

import type { ImpactOptions } from "../../lib/impact";
import type { Asset, AssetImpact, ImpactNode, RelationshipType } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

export interface ImpactRow {
  readonly id: string;
  /** Asset name when resolvable, otherwise a compact id fragment. */
  readonly label: string;
  readonly depth: number;
  readonly depthLabel: string;
  readonly relationshipLabel: string;
  readonly tone: BadgeTone;
}

/** Search-depth chips shown above the impact list. */
export const IMPACT_DEPTH_CHIPS: readonly number[] = [1, 2, 5, 10];

export const RELATIONSHIP_LABELS: Readonly<Record<RelationshipType, string>> = {
  derived_from: "Derived from",
  variant_of: "Variant of",
  uses_input: "Uses input",
  related_to: "Related to",
  duplicate_of: "Duplicate of",
};

function toneForDepth(depth: number): BadgeTone {
  if (depth <= 1) return "accent";
  if (depth === 2) return "info";
  return "neutral";
}

/** Human label for a 1-based lineage depth ("Direct" for first-level children). */
export function impactDepthLabel(depth: number): string {
  if (!Number.isFinite(depth) || depth < 1) return "Direct";
  return depth === 1 ? "Direct" : `Depth ${depth}`;
}

/** Human label for a canonical lineage relationship, with a render-safe fallback. */
export function relationshipLabel(relationship: ImpactNode["relationship"]): string {
  if (!relationship) return "Related";
  return RELATIONSHIP_LABELS[relationship] ?? "Related";
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

/**
 * Map a canonical `AssetImpact` to render-ready rows, keeping the backend's
 * breadth-first depth order. `assets` resolves descendant ids to asset names
 * when available (siblings in the current project) and otherwise falls back to
 * a compact id so the row remains readable.
 */
export function impactRows(
  impact: AssetImpact | undefined,
  assets: readonly Asset[] = [],
): readonly ImpactRow[] {
  const descendants: readonly ImpactNode[] = impact?.descendants ?? [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  return descendants.map((node) => {
    const depth =
      typeof node.depth === "number" && Number.isFinite(node.depth) ? node.depth : 1;
    return {
      id: node.asset_id,
      label: byId.get(node.asset_id)?.name ?? shortId(node.asset_id),
      depth,
      depthLabel: impactDepthLabel(depth),
      relationshipLabel: relationshipLabel(node.relationship),
      tone: toneForDepth(depth),
    };
  });
}

/** Header description derived from visible rows and the untruncated total. */
export function impactSummary(
  impact: AssetImpact | undefined,
  rows: readonly ImpactRow[],
): string {
  if (rows.length === 0) return "No downstream assets";
  const total = impact?.total ?? rows.length;
  const maxDepth = rows.reduce((deepest, row) => Math.max(deepest, row.depth), 0);
  return `${total} downstream asset${total === 1 ? "" : "s"} · max depth ${maxDepth}`;
}

/** Hook options from the selected depth chip; `undefined` uses the API default. */
export function buildImpactOptions(maxDepth: number): ImpactOptions | undefined {
  return maxDepth > 0 ? { maxDepth } : undefined;
}

/** Filter-aware empty-state copy for the panel. */
export function impactEmptyDescription(): string {
  return "No assets are derived from this asset yet. Downstream assets appear here as the pipeline creates them.";
}
