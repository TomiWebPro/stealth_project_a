/**
 * Authoritative asset lineage statistics derivation + query helpers (C77 follow-up).
 *
 * The backend (`LineageStatsRepository`) derives the whole snapshot from the
 * authoritative relationship + asset stores on every call, with no second index.
 * `lib/lineageStats` reproduces that derivation exactly so mock mode stays at
 * feature parity with live mode and the parity guard can drive both transports
 * over the same relationship seeds.
 */

import { ApiError } from "../api/client";
import type {
  Asset,
  LineageProjectCount,
  LineageStats,
  LineageTypeCount,
  RelationshipType,
} from "./types";

/** Optional scope mirrored from the authoritative `/lineage/stats` endpoint. */
export interface LineageStatsOptions {
  readonly projectId?: string;
}

/** Minimal authoritative relationship shape, matching `AssetRelationship`. */
export interface AssetRelationshipRecord {
  readonly id: string;
  readonly from_asset_id: string;
  readonly to_asset_id: string;
  readonly type: RelationshipType;
  readonly created_at: string;
}

/** Canonical relationship types, matching `get_args(RelationshipType)` on the backend. */
export const LINEAGE_RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  "derived_from",
  "variant_of",
  "uses_input",
  "related_to",
  "duplicate_of",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live
 * fail identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validateLineageStatsArgs(options: LineageStatsOptions = {}): void {
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
function compareNewest(a: AssetRelationshipRecord, b: AssetRelationshipRecord): number {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? 1 : -1;
  if (a.id !== b.id) return a.id > b.id ? 1 : -1;
  return 0;
}

/**
 * Derive lineage metrics exactly as the backend repository does: relationships
 * are attributed to the project of their source asset; links from soft-deleted
 * or unknown sources are excluded; `by_type` is zero-filled over every canonical
 * type; `by_project` is sorted by descending link count then project id; and
 * `total_linked_assets` counts distinct live assets present as either endpoint
 * of a counted link. An empty scope yields zero counts, zero-filled type buckets,
 * an empty project breakdown and a `null` recency (never an error).
 */
export function deriveLineageStats(
  relationships: readonly AssetRelationshipRecord[],
  assets: readonly Asset[],
  now: string,
  options: LineageStatsOptions = {},
): LineageStats {
  const projectByAsset = new Map<string, string>();
  for (const asset of assets) {
    if (asset.status !== "deleted") projectByAsset.set(asset.id, asset.project_id);
  }

  let scoped = relationships.filter((rel) => projectByAsset.has(rel.from_asset_id));
  if (options.projectId) {
    scoped = scoped.filter((rel) => projectByAsset.get(rel.from_asset_id) === options.projectId);
  }

  const typeCounts = new Map<string, number>();
  const projectCounts = new Map<string, number>();
  const linkedAssets = new Set<string>();
  let newest: AssetRelationshipRecord | undefined;

  for (const rel of scoped) {
    typeCounts.set(rel.type, (typeCounts.get(rel.type) ?? 0) + 1);
    const projectId = projectByAsset.get(rel.from_asset_id) as string;
    projectCounts.set(projectId, (projectCounts.get(projectId) ?? 0) + 1);
    linkedAssets.add(rel.from_asset_id);
    if (projectByAsset.has(rel.to_asset_id)) linkedAssets.add(rel.to_asset_id);
    if (!newest || compareNewest(rel, newest) > 0) newest = rel;
  }

  const byType: LineageTypeCount[] = LINEAGE_RELATIONSHIP_TYPES.map((type) => ({
    type,
    count: typeCounts.get(type) ?? 0,
  }));
  const byProject: LineageProjectCount[] = [...projectCounts.entries()]
    .map(([project_id, relationships]) => ({ project_id, relationships }))
    .sort((a, b) => b.relationships - a.relationships || a.project_id.localeCompare(b.project_id));

  return {
    total_relationships: scoped.length,
    total_linked_assets: linkedAssets.size,
    by_type: byType,
    by_project: byProject,
    newest_relationship_at: newest?.created_at ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/lineage/stats` request. */
export function lineageStatsQueryParams(
  options: LineageStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
