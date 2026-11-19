/**
 * Authoritative upload statistics derivation + query helpers (C97 follow-up).
 *
 * The backend (`UploadStatsRepository`) keeps no second index: it derives the
 * whole snapshot from the authoritative `UPLOADS` collection on every call,
 * zero-fills `by_status` over the canonical `UploadStatus` values, builds a
 * deterministic per-project breakdown and takes the newest ticket's
 * `created_at` as the recency marker. `lib/uploadStats` reproduces that
 * derivation over the same seeds so mock mode stays at feature parity with live
 * mode and the parity guard can drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { UploadProjectCount, UploadStatus, UploadStats, UploadStatusCount } from "./types";

/** Optional scope mirrored from the authoritative `/uploads/stats` endpoint. */
export interface UploadStatsOptions {
  readonly projectId?: string;
}

/**
 * Minimal shape shared by the authoritative upload-ticket documents. The backend
 * `UploadRecord` carries more fields (filename, content type, path, expiry), but
 * only these feed the statistics derivation; keeping the seed shape small avoids
 * duplicating unrelated upload wire contracts in the mock data layer.
 */
export interface UploadRecord {
  readonly upload_id: string;
  readonly project_id: string;
  readonly size_bytes: number;
  readonly status: UploadStatus;
  readonly created_at: string;
}

/** Canonical upload-ticket lifecycle states in their documented order. */
export const UPLOAD_STATUSES: readonly UploadStatus[] = ["pending", "complete"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live fail
 * identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validateUploadStatsArgs(options: UploadStatsOptions = {}): void {
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
 * Derive upload-ticket metrics exactly as the backend repository does:
 * completed byte totals only, a zero-filled per-status breakdown, per-project
 * ticket activity sorted by descending count then project id, and the newest
 * ticket's creation time as recency. An empty scope yields zero counts,
 * zero-filled status buckets, an empty project breakdown and `newest_upload_at:
 * null` (never an error).
 */
export function deriveUploadStats(
  records: readonly UploadRecord[],
  now: string,
  options: UploadStatsOptions = {},
): UploadStats {
  const scoped = options.projectId
    ? records.filter((record) => record.project_id === options.projectId)
    : records;

  let pending = 0;
  let completed = 0;
  let bytesUploaded = 0;
  const projectTotals = new Map<string, [number, number, number]>();
  let newest: string | null = null;

  for (const record of scoped) {
    if (record.status === "complete") {
      completed += 1;
      bytesUploaded += record.size_bytes;
    } else {
      pending += 1;
    }

    const bucket = projectTotals.get(record.project_id) ?? [0, 0, 0];
    bucket[0] += 1;
    if (record.status === "complete") {
      bucket[1] += 1;
      bucket[2] += record.size_bytes;
    }
    projectTotals.set(record.project_id, bucket);

    if (record.created_at > (newest ?? "")) newest = record.created_at;
  }

  const byStatus: UploadStatusCount[] = UPLOAD_STATUSES.map((status) => ({
    status,
    count: status === "pending" ? pending : completed,
  }));

  const byProject: UploadProjectCount[] = [...projectTotals.entries()]
    .map(([projectId, totals]) => ({
      project_id: projectId,
      total: totals[0] ?? 0,
      completed: totals[1] ?? 0,
      bytes_uploaded: totals[2] ?? 0,
    }))
    .sort((a, b) => b.total - a.total || (a.project_id < b.project_id ? -1 : a.project_id > b.project_id ? 1 : 0));

  return {
    total_tickets: scoped.length,
    pending,
    completed,
    bytes_uploaded: bytesUploaded,
    by_status: byStatus,
    by_project: byProject,
    newest_upload_at: newest,
    generated_at: now,
  };
}

/** Query-string values for the live `/uploads/stats` request. */
export function uploadStatsQueryParams(
  options: UploadStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
