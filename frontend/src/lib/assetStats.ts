/**
 * Authoritative asset inventory statistics derivation + query helpers (C49 follow-up).
 *
 * The backend (`AssetStatsRepository`) derives the whole snapshot from the
 * authoritative asset store on every call — there is no second index. `lib/assetStats`
 * reproduces that derivation exactly so mock mode stays at feature parity with
 * live mode and the parity guard can drive both transports over the same seeds.
 */

import { ApiError } from "../api/client";
import type { Asset, AssetStats, AssetStatus, AssetStatusCount, AssetType, AssetTypeCount } from "./types";

/** Optional scope mirrored from the authoritative `/assets/stats` endpoint. */
export interface AssetStatsOptions {
  readonly projectId?: string;
}

/** Canonical asset types, matching `get_args(AssetType)` on the backend. */
export const ASSET_TYPES: readonly AssetType[] = [
  "image",
  "video",
  "audio",
  "model3d",
  "splat",
  "texture",
  "dataset",
  "lora",
  "scene",
  "resource",
];

/** Canonical lifecycle statuses, matching `get_args(AssetStatus)` on the backend. */
export const ASSET_STATUSES: readonly AssetStatus[] = [
  "pending",
  "processing",
  "ready",
  "failed",
  "deleted",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live
 * fail identically with the shared normalized error envelope.
 */
export function validateAssetStatsArgs(options: AssetStatsOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
}

/** Python-compatible `(created_at, str(id))` tuple comparison for recency. */
function compareNewest<T extends { created_at: string; id: string }>(a: T, b: T): number {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? 1 : -1;
  if (a.id !== b.id) return a.id > b.id ? 1 : -1;
  return 0;
}

/**
 * Derive asset inventory metrics exactly as the backend repository does: soft
 * -deleted assets are excluded, `by_type`/`by_status` are zero-filled over the
 * canonical type/status orders, stored bytes and version revisions are summed,
 * and recency is the newest live asset's `created_at`. An empty scope yields
 * zero counts, empty arrays and a `null` recency (never an error). A missing
 * `status`/`version` defaults to `ready`/`1`, matching the backend schema.
 */
export function deriveAssetStats(
  assets: readonly Asset[],
  now: string,
  options: AssetStatsOptions = {},
): AssetStats {
  const live = assets.filter(
    (asset) =>
      (asset.status ?? "ready") !== "deleted" &&
      (!options.projectId || asset.project_id === options.projectId),
  );

  const typeCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  for (const asset of live) {
    typeCounts.set(asset.type, (typeCounts.get(asset.type) ?? 0) + 1);
    const status = asset.status ?? "ready";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const byType: AssetTypeCount[] = ASSET_TYPES.map((type) => ({
    type,
    count: typeCounts.get(type) ?? 0,
  }));
  const byStatus: AssetStatusCount[] = ASSET_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));

  const newest = [...live].sort((a, b) => compareNewest(b, a))[0];
  const totalSizeBytes = live.reduce((sum, asset) => sum + asset.storage.size_bytes, 0);
  const totalVersions = live.reduce((sum, asset) => sum + (asset.version ?? 1), 0);

  return {
    total: live.length,
    by_type: byType,
    by_status: byStatus,
    total_size_bytes: totalSizeBytes,
    total_versions: totalVersions,
    newest_asset_at: newest?.created_at ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/assets/stats` request. */
export function assetStatsQueryParams(
  options: AssetStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
