/**
 * Authoritative asset feed derivation + query helpers (C137 follow-up).
 *
 * The backend (`AssetFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of live assets fresh from the authoritative
 * `ASSETS` collection — the same store `GET /assets` lists and `GET /assets/stats`
 * reads — so the feed can never drift from those views or from what actually
 * exists. Each item's project display name is joined from the authoritative
 * project store (with a stable fallback for a missing project), soft-deleted
 * assets are excluded, ordering is by descending `(created_at, asset_id)` so the
 * wire shape is byte-for-byte identical across the in-memory and SQLite stores,
 * and `total` counts the whole filtered feed before the `limit` page is applied.
 *
 * `lib/assetFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Asset, AssetFeed, AssetFeedItem, Project } from "./types";

/** Optional scope + page bounds mirrored from the authoritative `/assets/feed` endpoint. */
export interface AssetFeedOptions {
  readonly projectId?: string;
  readonly limit?: number;
}

/** Stable display name used by the backend when an asset's project is missing. */
export const UNKNOWN_ASSET_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id` or a `limit`
 * outside 1..200 is rejected with a 422. An unknown-but-valid project is a 404
 * checked by the fetch layer against the project seeds.
 */
export function validateAssetFeedArgs(options: AssetFeedOptions = {}): void {
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
 * Derive the asset feed exactly as the backend repository does: project each
 * live asset, optionally scope to one project, join project names (falling back
 * to a stable display name for missing projects), sort newest-first with an
 * asset-id tie-break and apply the `limit` page. Soft-deleted assets are excluded,
 * and a missing `status`/`version` defaults to `ready`/`1`, matching the backend
 * schema. `total` counts the whole filtered feed before paging. An empty scope
 * yields an empty feed (never an error).
 */
export function deriveAssetFeed(
  assets: readonly Asset[],
  projects: readonly Project[],
  now: string,
  options: AssetFeedOptions = {},
): AssetFeed {
  const { projectId, limit = DEFAULT_LIMIT } = options;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const items: AssetFeedItem[] = [];
  for (const asset of assets) {
    if ((asset.status ?? "ready") === "deleted") continue;
    if (projectId !== undefined && asset.project_id !== projectId) continue;
    items.push({
      asset_id: asset.id,
      project_id: asset.project_id,
      project_name: projectNames.get(asset.project_id) ?? UNKNOWN_ASSET_PROJECT_NAME,
      type: asset.type,
      name: asset.name,
      status: asset.status ?? "ready",
      version: asset.version ?? 1,
      size_bytes: asset.storage.size_bytes,
      created_at: asset.created_at,
      updated_at: asset.updated_at,
    });
  }

  items.sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) ||
      b.asset_id.localeCompare(a.asset_id),
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/assets/feed` request. */
export function assetFeedQueryParams(
  options: AssetFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, limit: options.limit };
}
