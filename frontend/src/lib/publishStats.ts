/**
 * Authoritative publish statistics derivation + query helpers (C113
 * follow-up).
 *
 * The backend (`PublishStatsRepository`) keeps no second index: it derives the
 * whole snapshot from the authoritative `ASSETS` collection, reading each live
 * asset's `metadata.publish_receipt`. Only assets that are not soft-deleted and
 * that carry a well-formed receipt (integer `version` >= 1, non-negative integer
 * `size_bytes` and a parseable `published_at`) contribute. `by_version` is
 * ordered by ascending version number and `by_project` by descending published
 * count then project id, keeping the wire shape deterministic across the
 * in-memory and SQLite stores. An optional `project_id` scope narrows the same
 * derivation. `lib/publishStats` reproduces that derivation over the same seeds
 * so mock mode stays at feature parity with live mode and the parity guard can
 * drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Asset, PublishStats, PublishVersionCount, PublishProjectCount } from "./types";

/** Optional scope mirrored from the authoritative `/publishes/stats` endpoint. */
export interface PublishStatsOptions {
  readonly projectId?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live fail
 * identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validatePublishStatsArgs(options: PublishStatsOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
}

/** Parsed fields of a well-formed publish receipt. */
interface ParsedReceipt {
  readonly version: number;
  readonly sizeBytes: number;
  readonly publishedAt: string;
}

/**
 * Mirror the backend receipt parser: a usable receipt has an integer version
 * >= 1, a non-negative integer byte size and an ISO publish time. Anything else
 * (missing fields, wrong types, boolean numbers, unparseable dates) is ignored
 * the same way an orphan record is.
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
 * Derive publish metrics exactly as the backend repository does: read the
 * publish receipt of each live asset, drop soft-deleted assets and malformed
 * receipts, group by receipt version (ascending) and per project (descending
 * published count then project id), sum delivered bytes and take the newest
 * publish time as the recency marker. An empty scope yields zero counts, empty
 * breakdowns and a `null` recency (never an error).
 */
export function derivePublishStats(
  assets: readonly Asset[],
  now: string,
  options: PublishStatsOptions = {},
): PublishStats {
  const versionCounts = new Map<number, number>();
  const publishedByProject = new Map<string, number>();
  const bytesByProject = new Map<string, number>();
  let totalBytes = 0;
  let totalPublished = 0;
  let newest: string | undefined;

  for (const asset of assets) {
    if ((asset.status ?? "ready") === "deleted") continue;
    const parsed = parseReceipt(asset.metadata?.["publish_receipt"]);
    if (parsed === undefined) continue;
    if (options.projectId !== undefined && asset.project_id !== options.projectId) continue;

    totalPublished += 1;
    totalBytes += parsed.sizeBytes;
    versionCounts.set(parsed.version, (versionCounts.get(parsed.version) ?? 0) + 1);
    publishedByProject.set(
      asset.project_id,
      (publishedByProject.get(asset.project_id) ?? 0) + 1,
    );
    bytesByProject.set(
      asset.project_id,
      (bytesByProject.get(asset.project_id) ?? 0) + parsed.sizeBytes,
    );

    // Python keeps the full `datetime`; ISO-8601 UTC strings compare
    // chronologically as strings, so lexical max is equivalent here.
    if (newest === undefined || parsed.publishedAt > newest) {
      newest = parsed.publishedAt;
    }
  }

  const byVersion: PublishVersionCount[] = [...versionCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([version, count]) => ({ version, count }));

  const byProject: PublishProjectCount[] = [...publishedByProject.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([projectId, published]) => ({
      project_id: projectId,
      published,
      bytes: bytesByProject.get(projectId) ?? 0,
    }));

  return {
    total_published: totalPublished,
    total_bytes: totalBytes,
    by_version: byVersion,
    by_project: byProject,
    newest_published_at: newest ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/publishes/stats` request. */
export function publishStatsQueryParams(
  options: PublishStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
