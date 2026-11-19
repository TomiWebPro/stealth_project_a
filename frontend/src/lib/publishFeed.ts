/**
 * Authoritative publish-feed derivation + query helpers (C125 follow-up).
 *
 * The backend (`PublishFeedRepository`) keeps no second index: it derives a
 * newest-first feed of published deliverables fresh from the authoritative
 * `ASSETS` collection, reading each live asset's `metadata.publish_receipt`. Only
 * assets that are not soft-deleted and that carry a well-formed receipt
 * (integer `version` >= 1, non-negative integer `size_bytes` and a parseable
 * `published_at`) contribute. Project display names are joined from the
 * authoritative project store, with a stable fallback for an asset whose project
 * is missing. Ordering is by descending `(published_at, asset_id)` so the wire
 * shape is deterministic across the in-memory and SQLite stores, and `total`
 * counts the whole filtered feed before the `limit` page is applied.
 *
 * `lib/publishFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Asset, Project, PublishFeed, PublishFeedItem } from "./types";

/** Optional scope + page bounds mirrored from the authoritative `/publishes` endpoint. */
export interface PublishFeedOptions {
  readonly projectId?: string;
  readonly limit?: number;
}

/** Stable display name used by the backend when an asset's project is missing. */
export const UNKNOWN_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id` or a `limit`
 * outside 1..200 is rejected with a 422. An unknown-but-valid project is a 404
 * checked by the fetch layer against the project seeds.
 */
export function validatePublishFeedArgs(options: PublishFeedOptions = {}): void {
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

/** Parsed fields of a well-formed publish receipt (mirrors `publishStats`). */
interface ParsedReceipt {
  readonly version: number;
  readonly sizeBytes: number;
  readonly publishedAt: string;
}

/**
 * Mirror the backend receipt parser: a usable receipt has an integer version
 * >= 1, a non-negative integer byte size and an ISO publish time. Anything else
 * (missing fields, wrong types, boolean numbers, unparseable dates) is ignored
 * the same way a malformed receipt is on the backend.
 */
function parseReceipt(receipt: unknown): ParsedReceipt | undefined {
  if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt)) return undefined;
  const raw = receipt as Record<string, unknown>;
  const version = raw["version"];
  const sizeBytes = raw["size_bytes"];
  const publishedAt = raw["published_at"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return undefined;
  if (typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes < 0) {
    return undefined;
  }
  if (typeof publishedAt !== "string" || !Number.isFinite(Date.parse(publishedAt))) return undefined;
  return { version, sizeBytes, publishedAt };
}

/**
 * Derive the publish feed exactly as the backend repository does: read each
 * live asset's publish receipt, drop soft-deleted assets and malformed receipts,
 * optionally scope to one project, join project names (falling back to a stable
 * display name for missing projects), sort newest-first with an asset-id
 * tie-break and apply the `limit` page. `total` counts the whole filtered feed
 * before paging. An empty scope yields an empty feed (never an error).
 */
export function derivePublishFeed(
  assets: readonly Asset[],
  projects: readonly Project[],
  now: string,
  options: PublishFeedOptions = {},
): PublishFeed {
  const { projectId, limit = DEFAULT_LIMIT } = options;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const items: PublishFeedItem[] = [];
  for (const asset of assets) {
    if ((asset.status ?? "ready") === "deleted") continue;
    const parsed = parseReceipt(asset.metadata?.["publish_receipt"]);
    if (parsed === undefined) continue;
    if (projectId !== undefined && asset.project_id !== projectId) continue;
    items.push({
      asset_id: asset.id,
      asset_name: asset.name,
      asset_type: asset.type,
      project_id: asset.project_id,
      project_name: projectNames.get(asset.project_id) ?? UNKNOWN_PROJECT_NAME,
      version: parsed.version,
      size_bytes: parsed.sizeBytes,
      published_at: parsed.publishedAt,
    });
  }

  items.sort(
    (a, b) => b.published_at.localeCompare(a.published_at) || b.asset_id.localeCompare(a.asset_id),
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/publishes` request. */
export function publishFeedQueryParams(
  options: PublishFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, limit: options.limit };
}
