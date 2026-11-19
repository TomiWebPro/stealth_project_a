/**
 * Authoritative upload-ticket feed derivation + query helpers (C129 follow-up).
 *
 * The backend (`UploadFeedRepository`) keeps no second index: it derives a
 * newest-first feed of upload tickets fresh from the authoritative `UPLOADS`
 * collection — the same store `/uploads/stats` reads — so the feed can never
 * drift from the upload snapshot or from what actually exists. Project display
 * names are joined from the authoritative project store, with a stable fallback
 * for a ticket whose project is missing. Ordering is by descending
 * `(created_at, upload_id)` so the wire shape is deterministic across the
 * in-memory and SQLite stores, and `total` counts the whole filtered feed before
 * the `limit` page is applied.
 *
 * `lib/uploadFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { UploadRecord } from "./uploadStats";
import type { Project, UploadFeed, UploadFeedItem } from "./types";

/** Optional scope + page bounds mirrored from the authoritative `/uploads/feed` endpoint. */
export interface UploadFeedOptions {
  readonly projectId?: string;
  readonly limit?: number;
}

/**
 * A seeded upload ticket with the fields the feed projects. The stats derivation
 * only needs the smaller `UploadRecord` subset; this superset carries the extra
 * display fields the authoritative `UploadRecord` dataclass stores (filename,
 * content type, declared size and expiry).
 */
export interface UploadFeedRecord extends UploadRecord {
  readonly filename: string;
  readonly content_type: string;
  readonly declared_size: number;
  readonly expires_at: string;
}

/** Stable display name used by the backend when a ticket's project is missing. */
export const UNKNOWN_UPLOAD_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id` or a `limit`
 * outside 1..200 is rejected with a 422. An unknown-but-valid project is a 404
 * checked by the fetch layer against the project seeds.
 */
export function validateUploadFeedArgs(options: UploadFeedOptions = {}): void {
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
 * Derive the upload feed exactly as the backend repository does: project each
 * ticket, optionally scope to one project, join project names (falling back to a
 * stable display name for missing projects), sort newest-first with an upload-id
 * tie-break and apply the `limit` page. `total` counts the whole filtered feed
 * before paging. An empty scope yields an empty feed (never an error).
 */
export function deriveUploadFeed(
  records: readonly UploadFeedRecord[],
  projects: readonly Project[],
  now: string,
  options: UploadFeedOptions = {},
): UploadFeed {
  const { projectId, limit = DEFAULT_LIMIT } = options;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const items: UploadFeedItem[] = [];
  for (const record of records) {
    if (projectId !== undefined && record.project_id !== projectId) continue;
    items.push({
      upload_id: record.upload_id,
      project_id: record.project_id,
      project_name: projectNames.get(record.project_id) ?? UNKNOWN_UPLOAD_PROJECT_NAME,
      filename: record.filename,
      content_type: record.content_type,
      status: record.status,
      declared_size: record.declared_size,
      size_bytes: record.size_bytes,
      created_at: record.created_at,
      expires_at: record.expires_at,
    });
  }

  items.sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.upload_id.localeCompare(a.upload_id),
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/uploads/feed` request. */
export function uploadFeedQueryParams(
  options: UploadFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, limit: options.limit };
}
