/**
 * Authoritative downstream asset-impact derivation + query helpers (C34 follow-up).
 *
 * The backend (`ImpactRepository`) walks inbound lineage relationships from the
 * authoritative relationship store on every call — there is no second index.
 * `lib/impact` reproduces that breadth-first derivation from the mock assets'
 * `parent_asset_ids` so mock mode stays at feature parity with live mode and the
 * parity guard can drive both transports over the same seeds.
 */

import { ApiError } from "../api/client";
import type { Asset, AssetImpact, ImpactNode, RelationshipType } from "./types";

/** Optional filter mirrored from the authoritative `/assets/{id}/impact` endpoint. */
export interface ImpactOptions {
  readonly maxDepth?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Parent links express the same lineage edge the backend stores as `derived_from`. */
const LINEAGE_RELATIONSHIP: RelationshipType = "derived_from";
const DEFAULT_MAX_DEPTH = 5;
const MAX_DEPTH = 20;

/**
 * Mirror the router's 422 validation so mock and live fail identically: a
 * malformed `asset_id` path param or a `max_depth` outside 1..20 are rejected
 * with the same normalized error envelope.
 */
export function validateImpactArgs(assetId: string, options: ImpactOptions = {}): void {
  if (!UUID_PATTERN.test(assetId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid asset id.",
      details: [{ field: "asset_id", message: "asset_id must be a valid UUID" }],
    });
  }
  if (
    options.maxDepth !== undefined &&
    (!Number.isInteger(options.maxDepth) || options.maxDepth < 1 || options.maxDepth > MAX_DEPTH)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Impact max depth must be between 1 and 20.",
      details: [{ field: "max_depth", message: "max_depth must be between 1 and 20" }],
    });
  }
}

/**
 * Derive every transitive descendant of `rootId`, breadth-first, from the mock
 * assets' `parent_asset_ids` (child -> parent edges). Traversal is cycle-safe via
 * a visited set, bounded by `maxDepth`, deterministic across stores, and skips
 * soft-deleted descendants (and their subtrees), mirroring the backend exactly.
 */
export function deriveAssetImpact(
  rootId: string,
  assets: readonly Asset[],
  options: ImpactOptions = {},
): AssetImpact {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  // Index inbound edges: for each parent, the assets derived from it.
  const incoming = new Map<string, Asset[]>();
  for (const asset of assets) {
    for (const parentId of asset.parent_asset_ids ?? []) {
      const edges = incoming.get(parentId) ?? [];
      edges.push(asset);
      incoming.set(parentId, edges);
    }
  }
  for (const edges of incoming.values()) {
    edges.sort(
      (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  }

  const descendants: ImpactNode[] = [];
  const visited = new Set<string>([rootId]);
  const frontier: Array<[string, number]> = [[rootId, 0]];
  while (frontier.length > 0) {
    const [current, depth] = frontier.shift() as [string, number];
    if (depth >= maxDepth) continue;
    for (const child of incoming.get(current) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      if (child.status === "deleted") continue;
      descendants.push({
        asset_id: child.id,
        relationship: LINEAGE_RELATIONSHIP,
        depth: depth + 1,
      });
      frontier.push([child.id, depth + 1]);
    }
  }

  return { root_asset_id: rootId, descendants, total: descendants.length };
}

/** Query-string values for the live `/assets/{id}/impact` request. */
export function impactQueryParams(
  options: ImpactOptions = {},
): Record<string, string | number | undefined> {
  return { max_depth: options.maxDepth };
}
