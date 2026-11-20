/**
 * Authoritative single-tag overview derivation + query helpers (C282
 * follow-up).
 *
 * The backend (`TagOverviewRepository`) derives the whole snapshot fresh from
 * the authoritative `ASSETS` collection — the same store `/tags` facets and
 * `/assets/feed` projects — with no second index. The tag-match rule (exact,
 * case-sensitive membership in `asset.tags`) and the soft-delete exclusion are
 * identical to `/tags`, so `counts.tagged_assets` always equals the matching
 * facet for the same project scope. The recent page reuses the canonical
 * `AssetFeedItem` projection from `/assets/feed` so the two views cannot
 * disagree about an asset's wire shape, and is bounded newest-first with a
 * deterministic `(created_at, asset_id)` tie-break while `counts` describe whole
 * scopes and are never bounded. Project names are joined from the authoritative
 * project store with a stable fallback for orphan assets.
 *
 * An unknown tag (no live asset in scope carries it) is a 404 `tag_not_found`,
 * as is an unknown `project_id`; a malformed id or out-of-range `recent_limit`
 * uses the shared 422 envelope. Both 404s are checked by the fetch layer and
 * normalized to `undefined` by the transports.
 * `lib/tagOverview` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import { deriveAssetFeed, UNKNOWN_ASSET_PROJECT_NAME } from "./assetFeed";
import type { Asset, Project, TagOverview } from "./types";

/** Optional scope + page bound mirrored from the authoritative `/tags/{tag}/overview` endpoint. */
export interface TagOverviewOptions {
  readonly projectId?: string;
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface TagOverviewSeeds {
  readonly assets: readonly Asset[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_TAG_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`project_id` UUID and `recent_limit` ge=1,
 * le=50; a tag path segment is non-empty) so mock and live fail identically
 * with the shared normalized error envelope. Unknown tags/projects are 404s
 * checked by the fetch layer.
 */
export function validateTagOverviewArgs(tag: string, options: TagOverviewOptions = {}): void {
  if (!tag || tag.trim().length < 1) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Tag must not be empty.",
      details: [{ field: "tag", message: "tag must have at least 1 character" }],
    });
  }
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
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
      message: "Tag overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-tag snapshot exactly as the backend repository does: exclude
 * soft-deleted assets, optionally scope to one project, then count exact
 * (case-sensitive) tag membership at most once per asset. No live asset in
 * scope carrying the tag is a 404 `tag_not_found` (and an unknown project is a
 * 404 `project_not_found`). Whole-scope counts are never bounded by the recent
 * page; the page itself reuses the canonical asset-feed projection over the
 * tagged assets and is capped by `recentLimit`.
 */
export function deriveTagOverview(
  tag: string,
  seeds: TagOverviewSeeds,
  options: TagOverviewOptions = {},
): TagOverview {
  const { projectId, recentLimit = DEFAULT_TAG_OVERVIEW_RECENT_LIMIT } = options;
  const project =
    projectId !== undefined ? seeds.projects.find((candidate) => candidate.id === projectId) : undefined;
  if (projectId !== undefined && !project) {
    throw new ApiError({
      status: 404,
      code: "project_not_found",
      message: `Project '${projectId}' was not found.`,
    });
  }

  const liveInScope = seeds.assets.filter(
    (asset) =>
      (asset.status ?? "ready") !== "deleted" &&
      (projectId === undefined || asset.project_id === projectId),
  );
  const tagged = liveInScope.filter((asset) => (asset.tags ?? []).includes(tag));
  if (tagged.length === 0) {
    throw new ApiError({
      status: 404,
      code: "tag_not_found",
      message: `Tag '${tag}' was not found.`,
    });
  }

  // Canonical newest-first asset-feed projection (with the shared "Unknown
  // project" orphan fallback) over the tagged assets only; the page is bounded
  // here while the counts above stay whole-scope.
  const feed = deriveAssetFeed(tagged, seeds.projects, seeds.now, {
    limit: Number.MAX_SAFE_INTEGER,
  });

  return {
    tag,
    project_id: projectId ?? null,
    project_name: project?.name ?? null,
    counts: {
      tagged_assets: tagged.length,
      tagged_projects: new Set(tagged.map((asset) => asset.project_id)).size,
      scope_assets: liveInScope.length,
    },
    recent_assets: (feed.items ?? []).slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/tags/{tag}/overview` request. */
export function tagOverviewQueryParams(
  options: TagOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, recent_limit: options.recentLimit };
}

/** Stable fallback used by the canonical asset feed for orphan assets. */
export { UNKNOWN_ASSET_PROJECT_NAME };
