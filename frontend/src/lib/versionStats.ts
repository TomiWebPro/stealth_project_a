/**
 * Authoritative asset version statistics derivation + query helpers (C109
 * follow-up).
 *
 * The backend (`VersionStatsRepository`) keeps no second index: it derives the
 * whole snapshot from the authoritative `ASSET_VERSIONS` collection, joining each
 * record to its asset for project attribution. Every registered asset has a v1
 * record and `POST /assets/{id}/versions` appends v2, v3, …; records whose asset
 * is soft-deleted or unknown cannot be attributed and are excluded from every
 * view. `by_version` is ordered by ascending version number and `by_project` by
 * descending version count then project id, keeping the wire shape deterministic
 * across the in-memory and SQLite stores. An optional `project_id` scope narrows
 * the same derivation. `lib/versionStats` reproduces that derivation over the
 * same seeds so mock mode stays at feature parity with live mode and the parity
 * guard can drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Asset, VersionStats, VersionNumberCount, VersionProjectCount } from "./types";

/** Optional scope mirrored from the authoritative `/versions/stats` endpoint. */
export interface VersionStatsOptions {
  readonly projectId?: string;
}

/** Minimal shape of one authoritative asset version record. */
export interface AssetVersionRecord {
  readonly asset_id: string;
  readonly version: number;
  readonly created_at: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live fail
 * identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validateVersionStatsArgs(options: VersionStatsOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
}

/**
 * Derive version metrics exactly as the backend repository does: attribute each
 * version record to its live asset's project, drop records of soft-deleted or
 * unknown assets, group by version number (ascending) and per project
 * (descending version count then project id), count revisions as records with a
 * version of 2 or higher and take the newest `(created_at, asset_id)` record as
 * the recency marker. An empty scope yields zero counts, empty breakdowns and a
 * `null` recency (never an error).
 */
export function deriveVersionStats(
  versions: readonly AssetVersionRecord[],
  assets: readonly Asset[],
  now: string,
  options: VersionStatsOptions = {},
): VersionStats {
  const projectByAsset = new Map<string, string>();
  for (const asset of assets) {
    if ((asset.status ?? "ready") === "deleted") continue;
    projectByAsset.set(asset.id, asset.project_id);
  }

  const scoped = versions.filter((version) => {
    const projectId = projectByAsset.get(version.asset_id);
    if (projectId === undefined) return false; // orphan / soft-deleted asset
    return options.projectId === undefined || projectId === options.projectId;
  });

  const numberCounts = new Map<number, number>();
  const assetIdsByProject = new Map<string, Set<string>>();
  const versionsByProject = new Map<string, number>();
  let newest: AssetVersionRecord | undefined;

  for (const version of scoped) {
    numberCounts.set(version.version, (numberCounts.get(version.version) ?? 0) + 1);

    const projectId = projectByAsset.get(version.asset_id) ?? "";
    versionsByProject.set(projectId, (versionsByProject.get(projectId) ?? 0) + 1);
    let assetIds = assetIdsByProject.get(projectId);
    if (assetIds === undefined) {
      assetIds = new Set<string>();
      assetIdsByProject.set(projectId, assetIds);
    }
    assetIds.add(version.asset_id);

    // Python `max((created_at, str(asset_id)))` tie-break for deterministic recency.
    if (
      newest === undefined ||
      version.created_at > newest.created_at ||
      (version.created_at === newest.created_at && version.asset_id > newest.asset_id)
    ) {
      newest = version;
    }
  }

  const byVersion: VersionNumberCount[] = [...numberCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([version, count]) => ({ version, count }));

  const byProject: VersionProjectCount[] = [...versionsByProject.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([projectId, count]) => ({
      project_id: projectId,
      versions: count,
      assets: assetIdsByProject.get(projectId)?.size ?? 0,
    }));

  return {
    total_versions: scoped.length,
    total_assets: new Set(scoped.map((version) => version.asset_id)).size,
    revisions: scoped.filter((version) => version.version >= 2).length,
    by_version: byVersion,
    by_project: byProject,
    newest_version_at: newest?.created_at ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/versions/stats` request. */
export function versionStatsQueryParams(
  options: VersionStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
