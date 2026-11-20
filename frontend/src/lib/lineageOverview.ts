/**
 * Authoritative single lineage-relationship overview derivation + query helpers
 * (C258 follow-up).
 *
 * The backend (`LineageOverviewRepository`) derives the whole snapshot fresh from
 * the authoritative `ASSET_RELATIONSHIPS` collection — the same store
 * `/lineage/feed` projects and `/lineage/stats` aggregates — with both asset
 * names and the project name joined from the authoritative asset/project stores.
 * There is no second index. Only links whose source asset is live belong to the
 * canonical set (exactly as in the feed and the snapshot), so a relationship
 * whose source is soft-deleted/unknown is treated as not found (shared 404).
 *
 * `counts` reuses that canonical set so the single view cannot disagree with
 * `/lineage/stats` or `/lineage/feed`, and `recent_relationships` reuses the
 * canonical `LineageFeedItem` projection from `/lineage/feed` (same
 * `(created_at, id)` newest-first tie-break), so the wire shape is byte-for-byte
 * identical across both storage adapters. An unknown relationship is a 404
 * checked by the fetch layer and normalized to `undefined` by the transports;
 * a malformed id or invalid `recent_limit` uses the shared 422 envelope.
 *
 * `lib/lineageOverview` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data.
 */

import { ApiError } from "../api/client";
import { deriveLineageFeed } from "./lineageFeed";
import type { AssetRelationshipRecord } from "./lineageStats";
import type { Asset, LineageOverview, Project } from "./types";

/** Optional page bound mirrored from the authoritative `/lineage/{id}/overview` endpoint. */
export interface LineageOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface LineageOverviewSeeds {
  readonly relationships: readonly AssetRelationshipRecord[];
  readonly assets: readonly Asset[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_LINEAGE_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`relationship_id` UUID and `recent_limit`
 * ge=1, le=50) so mock and live fail identically with the shared normalized
 * error envelope. An unknown-but-valid relationship is a 404 checked by the
 * fetch layer against the canonical relationship set.
 */
export function validateLineageOverviewArgs(
  relationshipId: string,
  options: LineageOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(relationshipId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid relationship id.",
      details: [{ field: "relationship_id", message: "relationship_id must be a valid UUID" }],
    });
  }
  const { recentLimit } = options;
  if (
    recentLimit !== undefined &&
    (!Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > MAX_RECENT_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Lineage overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-relationship snapshot exactly as the backend repository does.
 * `relationshipId` is assumed to reference a canonical link (the fetch layer
 * rejects unknown links); an unseeded link or one from a soft-deleted/unknown
 * source throws the shared 404 envelope. Both endpoint names/types and the
 * source project name are joined from the authoritative stores with stable
 * fallbacks. Whole-source-asset counts reuse the canonical relationship set and
 * are never bounded by the newest-first sibling page.
 */
export function deriveLineageOverview(
  relationshipId: string,
  seeds: LineageOverviewSeeds,
  options: LineageOverviewOptions = {},
): LineageOverview {
  const liveAssets = new Map<string, Asset>();
  for (const asset of seeds.assets) {
    if (asset.status !== "deleted") liveAssets.set(asset.id, asset);
  }
  const projectNames = new Map(seeds.projects.map((project) => [project.id, project.name]));

  // Match the feed/stats exclusion so the overview cannot surface a link the
  // other lineage views omit (and so the source asset always has a project).
  const canonical = seeds.relationships.filter((rel) => liveAssets.has(rel.from_asset_id));
  const target = canonical.find((rel) => rel.id === relationshipId);
  if (!target) {
    throw new ApiError({
      status: 404,
      code: "relationship_not_found",
      message: `Relationship '${relationshipId}' was not found.`,
    });
  }

  const source = liveAssets.get(target.from_asset_id) as Asset;
  const related = liveAssets.get(target.to_asset_id);
  const projectId = source.project_id;
  const projectName = projectNames.get(projectId) ?? "Unknown project";

  // Whole-source-asset activity, derived from the same canonical set as the
  // feed/snapshot and never bounded by the page.
  const sourceUpstream = canonical.filter((rel) => rel.to_asset_id === source.id);
  const sourceDownstream = canonical.filter((rel) => rel.from_asset_id === source.id);
  const sourceTypes = new Set([...sourceUpstream, ...sourceDownstream].map((rel) => rel.type));
  const projectRelationships = canonical.filter(
    (rel) => (liveAssets.get(rel.from_asset_id) as Asset).project_id === projectId,
  );
  const counts: LineageOverview["counts"] = {
    source_upstream: sourceUpstream.length,
    source_downstream: sourceDownstream.length,
    source_types: sourceTypes.size,
    project_relationships: projectRelationships.length,
  };

  // The canonical lineage-feed projection already applies the same newest-first
  // `(created_at, id)` order, joins both asset names + the project name with
  // stable fallbacks and emits the exact `LineageFeedItem` wire shape the backend
  // reuses for the sibling page (counts above stay whole-asset/whole-project).
  const { recentLimit = DEFAULT_LINEAGE_OVERVIEW_RECENT_LIMIT } = options;
  const recentRelationships = deriveLineageFeed(
    sourceDownstream,
    seeds.assets,
    seeds.projects,
    seeds.now,
    { limit: recentLimit },
  ).items;

  return {
    id: target.id,
    from_asset_id: target.from_asset_id,
    to_asset_id: target.to_asset_id,
    from_asset_name: source.name,
    to_asset_name: related?.name ?? "Unknown asset",
    from_asset_type: source.type,
    to_asset_type: related?.type ?? null,
    project_id: projectId,
    project_name: projectName,
    type: target.type,
    created_at: target.created_at,
    counts,
    recent_relationships: recentRelationships,
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/lineage/{id}/overview` request. */
export function lineageOverviewQueryParams(
  options: LineageOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
