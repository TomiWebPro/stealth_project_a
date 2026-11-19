/**
 * Authoritative asset lineage-feed derivation + query helpers (C157 follow-up).
 *
 * The backend (`LineageFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of typed asset relationships fresh from the
 * authoritative `ASSET_RELATIONSHIPS` collection — the same store
 * `LineageStatsRepository` aggregates — so the two can never drift. A
 * relationship is attributed to the project of its source asset; links from
 * soft-deleted or unknown sources are excluded (matching `/lineage/stats`, so
 * the feed total agrees with the snapshot). A soft-deleted or unknown target is
 * kept but its display name falls back to a stable sentinel. Project and asset
 * display names are joined from the authoritative project/asset stores with
 * stable fallbacks, and ordering is by descending `(created_at, id)` so the wire
 * shape is byte-for-byte identical across the in-memory and SQLite stores.
 * `total` counts the whole filtered feed before the `limit` page is applied.
 *
 * An optional `project_id` scopes the same derivation to one project; an
 * unknown-but-well-formed project is a 404 checked by the fetch layer against
 * the project seeds, while a malformed id or invalid `limit` uses the shared
 * 422 envelope.
 *
 * `lib/lineageFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { AssetRelationshipRecord } from "./lineageStats";
import type { Asset, LineageFeed, LineageFeedItem, Project } from "./types";

/** Optional scope + page bounds mirrored from the authoritative `/lineage/feed` endpoint. */
export interface LineageFeedOptions {
  readonly projectId?: string;
  readonly limit?: number;
}

/** Stable display name used by the backend when a relationship's project is missing. */
export const UNKNOWN_LINEAGE_PROJECT_NAME = "Unknown project";

/** Stable display name used by the backend when a relationship's target asset is missing. */
export const UNKNOWN_LINEAGE_ASSET_NAME = "Unknown asset";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id` or a `limit`
 * outside 1..200 is rejected with a 422. An unknown-but-valid project is a 404
 * checked by the fetch layer against the project seeds.
 */
export function validateLineageFeedArgs(options: LineageFeedOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Derive the lineage feed exactly as the backend repository does: attribute each
 * relationship to its live source asset, drop links from soft-deleted/unknown
 * sources, optionally scope to one project, join both asset names and the project
 * name (falling back to stable display names for missing targets/projects), sort
 * newest-first with an `id` tie-break and apply the `limit` page. `total` counts
 * the whole filtered feed before paging. An empty scope yields an empty feed
 * (never an error).
 */
export function deriveLineageFeed(
  relationships: readonly AssetRelationshipRecord[],
  assets: readonly Asset[],
  projects: readonly Project[],
  now: string,
  options: LineageFeedOptions = {},
): LineageFeed {
  const { projectId, limit = DEFAULT_LIMIT } = options;

  const assetsById = new Map<string, Asset>();
  for (const asset of assets) {
    if ((asset.status ?? "ready") === "deleted") continue;
    assetsById.set(asset.id, asset);
  }
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const scoped = relationships.filter((rel) => {
    const source = assetsById.get(rel.from_asset_id);
    return source !== undefined && (projectId === undefined || source.project_id === projectId);
  });
  scoped.sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  );

  const items: LineageFeedItem[] = scoped.map((rel) => {
    const source = assetsById.get(rel.from_asset_id) as Asset;
    const target = assetsById.get(rel.to_asset_id);
    return {
      id: rel.id,
      from_asset_id: rel.from_asset_id,
      to_asset_id: rel.to_asset_id,
      from_asset_name: source.name,
      to_asset_name: target?.name ?? UNKNOWN_LINEAGE_ASSET_NAME,
      project_id: source.project_id,
      project_name: projectNames.get(source.project_id) ?? UNKNOWN_LINEAGE_PROJECT_NAME,
      type: rel.type,
      created_at: rel.created_at,
    };
  });

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/lineage/feed` request. */
export function lineageFeedQueryParams(
  options: LineageFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, limit: options.limit };
}
