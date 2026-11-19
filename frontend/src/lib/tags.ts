/**
 * Authoritative asset tag-facet derivation + query helpers (C33 follow-up).
 *
 * The backend (`TagRepository`) derives a most-used-first tag index from the
 * authoritative asset store on every call — there is no second index. `lib/tags`
 * reproduces that derivation exactly so mock mode stays at feature parity with
 * live mode and the parity guard can drive both transports over the same seeds.
 */

import { ApiError } from "../api/client";
import type { Asset, TagFacet, TagIndex } from "./types";

/** Optional filters mirrored from the authoritative `/tags` endpoint. */
export interface TagOptions {
  readonly projectId?: string;
  readonly prefix?: string;
  readonly limit?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's 422 validation so mock and live fail identically: a
 * malformed `project_id`, an empty `prefix` or a `limit` outside 1..200 are
 * rejected with the same normalized error envelope.
 */
export function validateTagArgs(options: TagOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
  if (options.prefix !== undefined && options.prefix.length < 1) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Tag prefix must not be empty.",
      details: [{ field: "prefix", message: "prefix must have at least 1 character" }],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Tag limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Derive the tag index exactly as the backend repository does: deleted assets
 * are excluded, each tag counts at most once per asset, an optional
 * case-insensitive prefix narrows the facets, and ordering is count-descending
 * with a stable lexical tie-break. `total` is the distinct-tag count *before*
 * the limit is applied.
 */
export function deriveTagIndex(assets: readonly Asset[], options: TagOptions = {}): TagIndex {
  const { projectId, prefix, limit = DEFAULT_LIMIT } = options;
  const needle = prefix ? prefix.toLowerCase() : undefined;
  const counts = new Map<string, number>();

  for (const asset of assets) {
    if (asset.status === "deleted") continue;
    if (projectId && asset.project_id !== projectId) continue;
    // Count each tag at most once per asset (an asset carrying a duplicate tag
    // is still one asset with that tag), matching the backend's `set(asset.tags)`.
    for (const tag of new Set(asset.tags ?? [])) {
      if (!tag || (needle !== undefined && !tag.toLowerCase().startsWith(needle))) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const facets: TagFacet[] = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (a, b) =>
        b.count - a.count || a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||
        a.name.localeCompare(b.name),
    );
  return { tags: facets.slice(0, limit), total: facets.length };
}

/** Query-string values for the live `/tags` request. */
export function tagQueryParams(
  options: TagOptions = {},
): Record<string, string | number | undefined> {
  return {
    project_id: options.projectId,
    prefix: options.prefix,
    limit: options.limit,
  };
}
