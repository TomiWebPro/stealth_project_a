/**
 * Authoritative single asset-version overview derivation + query helpers (C250
 * follow-up).
 *
 * The backend (`VersionOverviewRepository`) derives the whole snapshot fresh from
 * the authoritative `ASSET_VERSIONS`/`ASSETS`/`PROJECTS` stores on every call —
 * there is no second index. It projects one version's identity + storage, joined
 * parent-asset/project context, an `is_latest` flag and whole-asset version
 * activity whose counts reuse `/versions/stats` semantics (a version of 2 or
 * higher is a revision). `recent_versions` reuses the parent asset's version
 * records with a deterministic `(version, created_at, asset_id)` newest-first
 * order, so the single-version view cannot disagree with `/versions/stats` or
 * `/versions/feed`. Project display names are joined from the authoritative
 * project store with a stable fallback.
 *
 * `lib/versionOverview` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data. An unknown asset or a version that does
 * not exist for it is a 404 normalized to `undefined` by the transports; a
 * malformed id/version or an out-of-range `recent_limit` uses the shared 422
 * envelope.
 */

import { ApiError } from "../api/client";
import type { AssetVersionFeedRecord } from "./versionFeed";
import type { Asset, AssetVersion, Project, VersionOverview } from "./types";

/** Optional page bound mirrored from the authoritative `/assets/{id}/versions/{version}/overview` endpoint. */
export interface VersionOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface VersionOverviewSeeds {
  readonly projects: readonly Project[];
  readonly assets: readonly Asset[];
  readonly assetVersions: readonly AssetVersionFeedRecord[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

/** Stable display name used by the backend when a version's project cannot be resolved. */
export const UNKNOWN_VERSION_OVERVIEW_PROJECT_NAME = "Unknown project";

export const DEFAULT_VERSION_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's validation (`asset_id` UUID, `version` integer >= 1 and
 * `recent_limit` ge=1, le=50) so mock and live fail identically with the shared
 * normalized error envelope. An unknown-but-valid asset/version is a 404 checked
 * by the fetch layer.
 */
export function validateVersionOverviewArgs(
  assetId: string,
  version: number,
  options: VersionOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(assetId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid asset id.",
      details: [{ field: "asset_id", message: "asset_id must be a valid UUID" }],
    });
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Version must be a positive integer.",
      details: [{ field: "version", message: "version must be greater than or equal to 1" }],
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
      message: "Version overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-version snapshot exactly as the backend repository does.
 * `assetId`/`version` are assumed to resolve (the fetch layer normalizes 404s);
 * an unseeded asset or unknown version throws the shared 404 envelope. Whole-
 * asset counts are never bounded by `recent_limit` and the project name falls
 * back to a stable value for an orphan asset.
 */
export function deriveVersionOverview(
  assetId: string,
  version: number,
  seeds: VersionOverviewSeeds,
  options: VersionOverviewOptions = {},
): VersionOverview {
  const asset = seeds.assets.find((candidate) => candidate.id === assetId);
  if (!asset) {
    throw new ApiError({
      status: 404,
      code: "asset_not_found",
      message: `Asset '${assetId}' was not found.`,
    });
  }

  const versions = seeds.assetVersions.filter((record) => record.asset_id === assetId);
  const target = versions.find((record) => record.version === version);
  if (!target) {
    throw new ApiError({
      status: 404,
      code: "version_not_found",
      message: `Version '${version}' was not found for asset '${assetId}'.`,
    });
  }

  const project = seeds.projects.find((candidate) => candidate.id === asset.project_id);
  const recent = [...versions]
    .sort(
      (a, b) =>
        b.version - a.version ||
        b.created_at.localeCompare(a.created_at) ||
        b.asset_id.localeCompare(a.asset_id),
    )
    .slice(0, options.recentLimit ?? DEFAULT_VERSION_OVERVIEW_RECENT_LIMIT);

  // Version records carry the parent asset's storage in the authoritative schema;
  // the mock seeds omit it, so it is projected from the parent asset exactly as
  // the asset-overview derivation does.
  const recentVersions: AssetVersion[] = recent.map((record) => ({
    asset_id: record.asset_id,
    version: record.version,
    storage: asset.storage,
    created_at: record.created_at,
    created_by: record.created_by,
  }));

  return {
    asset_id: asset.id,
    asset_name: asset.name,
    asset_type: asset.type,
    project_id: asset.project_id,
    project_name: project?.name ?? UNKNOWN_VERSION_OVERVIEW_PROJECT_NAME,
    version: target.version,
    storage: asset.storage,
    created_by: target.created_by,
    created_at: target.created_at,
    is_latest: target.version === (asset.version ?? 1),
    counts: {
      asset_versions: versions.length,
      revisions: versions.filter((record) => record.version >= 2).length,
    },
    recent_versions: recentVersions,
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/assets/{id}/versions/{version}/overview` request. */
export function versionOverviewQueryParams(
  options: VersionOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
