/**
 * Authoritative asset version-feed derivation + query helpers (C153 follow-up).
 *
 * The backend (`VersionFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of asset versions fresh from the
 * authoritative `ASSET_VERSIONS` collection — the same store the version
 * statistics snapshot aggregates — so the two can never drift. A version record
 * carries no project or lifecycle status of its own, so it is attributed to its
 * asset: records of soft-deleted or unknown assets are excluded, project display
 * names are joined from the authoritative project store (with a stable fallback
 * for a missing project), and ordering is by descending `(created_at, asset_id,
 * version)` so the wire shape is byte-for-byte identical across the in-memory
 * and SQLite stores. `total` counts the whole filtered feed before the `limit`
 * page is applied.
 *
 * An optional `project_id` scopes the same derivation to one project; an
 * unknown-but-well-formed project is a 404 checked by the fetch layer against
 * the project seeds, while a malformed id or invalid `limit` uses the shared
 * 422 envelope.
 *
 * `lib/versionFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { AssetVersionRecord } from "./versionStats";
import type { Asset, Project, VersionFeed, VersionFeedItem } from "./types";

/** A version record enriched with the creator id the authoritative schema carries. */
export interface AssetVersionFeedRecord extends AssetVersionRecord {
  readonly created_by: string;
}

/** Optional scope + page bounds mirrored from the authoritative `/versions/feed` endpoint. */
export interface VersionFeedOptions {
  readonly projectId?: string;
  readonly limit?: number;
}

/** Stable display name used by the backend when a version's project is missing. */
export const UNKNOWN_VERSION_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id` or a `limit`
 * outside 1..200 is rejected with a 422. An unknown-but-valid project is a 404
 * checked by the fetch layer against the project seeds.
 */
export function validateVersionFeedArgs(options: VersionFeedOptions = {}): void {
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
 * Derive the version feed exactly as the backend repository does: attribute each
 * version to its live asset, drop records of soft-deleted/unknown assets,
 * optionally scope to one project, join project names (falling back to a stable
 * display name for missing projects), sort newest-first with an `(asset_id,
 * version)` tie-break and apply the `limit` page. `total` counts the whole
 * filtered feed before paging. An empty scope yields an empty feed (never an
 * error).
 */
export function deriveVersionFeed(
  versions: readonly AssetVersionFeedRecord[],
  assets: readonly Asset[],
  projects: readonly Project[],
  now: string,
  options: VersionFeedOptions = {},
): VersionFeed {
  const { projectId, limit = DEFAULT_LIMIT } = options;

  const assetsById = new Map<string, Asset>();
  for (const asset of assets) {
    if ((asset.status ?? "ready") === "deleted") continue;
    assetsById.set(asset.id, asset);
  }
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const items: VersionFeedItem[] = [];
  for (const version of versions) {
    const asset = assetsById.get(version.asset_id);
    if (asset === undefined) continue; // orphan / soft-deleted asset
    if (projectId !== undefined && asset.project_id !== projectId) continue;
    items.push({
      asset_id: asset.id,
      project_id: asset.project_id,
      project_name: projectNames.get(asset.project_id) ?? UNKNOWN_VERSION_PROJECT_NAME,
      asset_name: asset.name,
      asset_type: asset.type,
      version: version.version,
      created_by: version.created_by,
      created_at: version.created_at,
    });
  }

  items.sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) ||
      b.asset_id.localeCompare(a.asset_id) ||
      b.version - a.version,
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/versions/feed` request. */
export function versionFeedQueryParams(
  options: VersionFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, limit: options.limit };
}
