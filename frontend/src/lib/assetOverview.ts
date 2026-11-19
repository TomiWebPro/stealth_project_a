/**
 * Authoritative single-asset overview derivation + query helpers (C205
 * follow-up).
 *
 * The backend (`AssetOverviewRepository`) derives the whole snapshot fresh from
 * its authoritative stores on every call — there is no second index. It projects
 * one asset's identity, a `published` flag (reusing the `/publishes/stats`
 * receipt parser), cross-domain counts (version records, distinct live lineage
 * neighbours, comments and tags) and a bounded newest-version-first list.
 *
 * `lib/assetOverview` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data. Upstream/downstream counts reuse the
 * same lineage relationship set as `/assets/{id}/lineage` and
 * `/assets/{id}/impact`; soft-deleted/unknown related assets are excluded, so
 * the snapshot cannot disagree with those endpoints.
 *
 * An unknown asset is a 404 checked by the fetch layer against the asset seeds
 * (resolved to `undefined` by the transports); a malformed id or an out-of-range
 * `recent_limit` uses the shared 422 envelope.
 */

import { ApiError } from "../api/client";
import type { AssetRelationshipRecord } from "./lineageStats";
import { hasValidPublishReceipt } from "./publishStats";
import type { AssetVersionFeedRecord } from "./versionFeed";
import type { Asset, AssetOverview, AssetVersion, Comment, Project, RelationshipType } from "./types";

/** Optional page bound mirrored from the authoritative `/assets/{id}/overview` endpoint. */
export interface AssetOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface AssetOverviewSeeds {
  readonly projects: readonly Project[];
  readonly assets: readonly Asset[];
  readonly assetVersions: readonly AssetVersionFeedRecord[];
  readonly relationships: readonly AssetRelationshipRecord[];
  readonly comments: readonly Comment[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Relationship types that describe lineage (a child produced from a parent),
 * matching the backend's `LINEAGE_RELATIONSHIPS` set. `related_to` is
 * deliberately excluded, matching the resource routers.
 */
const LINEAGE_RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  "derived_from",
  "variant_of",
  "uses_input",
  "duplicate_of",
];
export const DEFAULT_ASSET_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`asset_id` UUID and `recent_limit` ge=1,
 * le=50) so mock and live fail identically with the shared normalized error
 * envelope. An unknown-but-valid asset is a 404 checked by the fetch layer.
 */
export function validateAssetOverviewArgs(
  assetId: string,
  options: AssetOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(assetId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid asset id.",
      details: [{ field: "asset_id", message: "asset_id must be a valid UUID" }],
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
      message: "Asset overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-asset snapshot exactly as the backend repository does.
 * `assetId` is assumed to exist (the fetch layer rejects unknown assets); an
 * unseeded asset yields a 404. Empty domains yield zero counts and an empty
 * recent-version list (never an error).
 */
export function deriveAssetOverview(
  assetId: string,
  seeds: AssetOverviewSeeds,
  options: AssetOverviewOptions = {},
): AssetOverview {
  const asset = seeds.assets.find((candidate) => candidate.id === assetId);
  if (!asset) {
    throw new ApiError({ status: 404, code: "not_found", message: "Asset not found." });
  }

  const { recentLimit = DEFAULT_ASSET_OVERVIEW_RECENT_LIMIT } = options;
  const project = seeds.projects.find((candidate) => candidate.id === asset.project_id);
  const projectName = project?.name ?? "Unknown project";

  // Newest version first by `(version, created_at, asset_id)`, mirroring the
  // repository's reverse sort; the asset id is constant here but retained for
  // deterministic parity with the backend ordering.
  const versions = seeds.assetVersions
    .filter((version) => version.asset_id === assetId)
    .sort(
      (a, b) =>
        b.version - a.version ||
        b.created_at.localeCompare(a.created_at) ||
        b.asset_id.localeCompare(a.asset_id),
    );

  // Only live assets participate as related endpoints (matching impact, which
  // excludes soft-deleted descendants, and the live asset set).
  const liveIds = new Set(
    seeds.assets.filter((candidate) => (candidate.status ?? "ready") !== "deleted").map((a) => a.id),
  );
  const upstreamIds = new Set<string>();
  const downstreamIds = new Set<string>();
  for (const relationship of seeds.relationships) {
    if (!LINEAGE_RELATIONSHIP_TYPES.includes(relationship.type)) continue;
    if (
      relationship.from_asset_id === assetId &&
      relationship.to_asset_id !== assetId &&
      liveIds.has(relationship.to_asset_id)
    ) {
      upstreamIds.add(relationship.to_asset_id);
    }
    if (
      relationship.to_asset_id === assetId &&
      relationship.from_asset_id !== assetId &&
      liveIds.has(relationship.from_asset_id)
    ) {
      downstreamIds.add(relationship.from_asset_id);
    }
  }

  const recentVersions: AssetVersion[] = versions.slice(0, recentLimit).map((version) => ({
    asset_id: version.asset_id,
    version: version.version,
    storage: asset.storage,
    created_at: version.created_at,
    created_by: version.created_by,
  }));

  return {
    asset_id: asset.id,
    asset_name: asset.name,
    asset_type: asset.type,
    status: asset.status ?? "ready",
    version: asset.version ?? 1,
    project_id: asset.project_id,
    project_name: projectName,
    created_at: asset.created_at,
    // Reuse the publish-stats receipt parser so this flag cannot drift from
    // GET /publishes/stats for the same asset.
    published: hasValidPublishReceipt(asset.metadata?.["publish_receipt"]),
    counts: {
      versions: versions.length,
      upstream: upstreamIds.size,
      downstream: downstreamIds.size,
      comments: seeds.comments.filter((comment) => comment.asset_id === assetId).length,
      tags: asset.tags?.length ?? 0,
    },
    recent_versions: recentVersions,
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/assets/{id}/overview` request. */
export function assetOverviewQueryParams(
  options: AssetOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
