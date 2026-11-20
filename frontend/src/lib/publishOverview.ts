/**
 * Authoritative single publish-receipt overview derivation + query helpers (C278
 * follow-up).
 *
 * The backend (`PublishOverviewRepository`) derives the whole snapshot fresh from
 * the authoritative `ASSETS` collection — the same store `/publishes` projects
 * and `/publishes/stats` aggregates — with no second index. The receipt validity
 * rule reuses `publishStats`' canonical parser and the sibling page reuses the
 * `PublishFeedItem` projection from `/publishes`, so this single-publication view
 * can never disagree with the feed or the publish snapshot. Only live (non-deleted)
 * assets with a well-formed receipt contribute. Siblings are scoped to the target
 * asset's project, newest-first with a deterministic `(published_at, asset_id)`
 * tie-break, while `counts` describe whole scopes and are never bounded by
 * `recent_limit`. Project names are joined from the authoritative project store
 * with a stable fallback for orphan assets.
 *
 * An unknown asset is a 404 `asset_not_found`; an existing asset without a usable
 * receipt (or a soft-deleted one) is a 404 `publish_not_found`. Both are checked
 * by the fetch layer and normalized to `undefined` by the transports; a malformed
 * id or out-of-range `recent_limit` uses the shared 422 envelope.
 * `lib/publishOverview` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import { derivePublishFeed, UNKNOWN_PROJECT_NAME } from "./publishFeed";
import type { Asset, Project, PublishOverview } from "./types";

/** Optional page bound mirrored from the authoritative `/publishes/{id}/overview` endpoint. */
export interface PublishOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface PublishOverviewSeeds {
  readonly assets: readonly Asset[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_PUBLISH_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`asset_id` UUID and `recent_limit` ge=1, le=50)
 * so mock and live fail identically with the shared normalized error envelope.
 * Unknown-but-valid assets / receipt-less assets are 404s checked by the fetch
 * layer.
 */
export function validatePublishOverviewArgs(
  assetId: string,
  options: PublishOverviewOptions = {},
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
      message: "Publish overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-publication snapshot exactly as the backend repository does.
 * The canonical publish-feed projection (unbounded here) supplies every live
 * published item sorted newest-first, so receipt parsing, soft-delete exclusion,
 * ordering and project-name joins are shared with `/publishes` and cannot drift.
 * An unknown asset throws the shared `asset_not_found` 404; an asset that does
 * not appear in the feed (deleted or without a usable receipt) throws
 * `publish_not_found`. Whole-scope counts are never bounded by the sibling page.
 */
export function derivePublishOverview(
  assetId: string,
  seeds: PublishOverviewSeeds,
  options: PublishOverviewOptions = {},
): PublishOverview {
  const target = seeds.assets.find((candidate) => candidate.id === assetId);
  if (!target) {
    throw new ApiError({
      status: 404,
      code: "asset_not_found",
      message: `Asset '${assetId}' was not found.`,
    });
  }

  // Reuse the unfiltered, newest-first feed projection so the sibling page and
  // the whole-scope counts agree byte-for-byte with `/publishes`.
  const feed = derivePublishFeed(seeds.assets, seeds.projects, seeds.now, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const items = feed.items ?? [];
  const targetItem = items.find((item) => item.asset_id === assetId);
  if (!targetItem) {
    throw new ApiError({
      status: 404,
      code: "publish_not_found",
      message: `Publication for asset '${assetId}' was not found.`,
    });
  }

  const { recentLimit = DEFAULT_PUBLISH_OVERVIEW_RECENT_LIMIT } = options;
  const project = seeds.projects.find((candidate) => candidate.id === target.project_id);
  const siblings = items.filter((item) => item.project_id === target.project_id);

  return {
    asset_id: targetItem.asset_id,
    asset_name: targetItem.asset_name,
    asset_type: targetItem.asset_type,
    project_id: targetItem.project_id,
    project_name: project?.name ?? UNKNOWN_PROJECT_NAME,
    version: targetItem.version,
    size_bytes: targetItem.size_bytes,
    published_at: targetItem.published_at,
    counts: {
      project_published: siblings.length,
      project_bytes: siblings.reduce((sum, item) => sum + item.size_bytes, 0),
      total_published: items.length,
    },
    recent_siblings: siblings.slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/publishes/{id}/overview` request. */
export function publishOverviewQueryParams(
  options: PublishOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
