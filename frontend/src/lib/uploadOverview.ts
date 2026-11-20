/**
 * Authoritative single-upload-ticket overview derivation + query helpers (C246
 * follow-up).
 *
 * The backend (`UploadOverviewRepository`) derives the whole snapshot fresh from
 * the authoritative `UPLOADS` collection — the same store `UploadRepository`
 * writes, `/uploads/stats` aggregates and `/uploads/feed` reads — with the project
 * display name joined from the authoritative project store. There is no second
 * index. The `counts` block reuses the exact per-project aggregation behind
 * `/uploads/stats` (ticket total, completed tickets and completed bytes), so the
 * single-ticket view can never disagree with that snapshot. `bytes_remaining`
 * and `progress` are pure derivations of the authoritative byte fields and
 * `expired` uses the injected clock, keeping the wire shape deterministic across
 * both storage adapters.
 *
 * `lib/uploadOverview` reproduces that derivation over the same upload/project
 * seeds so mock mode stays at feature parity with live mode and the parity guard
 * can drive both transports over identical data. An unknown ticket is a 404
 * checked by the fetch layer and normalized to `undefined` by the transports;
 * a malformed id uses the shared 422 envelope. The route has no query params.
 */

import { ApiError } from "../api/client";
import type { UploadFeedRecord } from "./uploadFeed";
import type { Project, UploadOverview } from "./types";

/** Stable display name used by the backend when a ticket's project cannot be resolved. */
export const UNKNOWN_UPLOAD_OVERVIEW_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's `upload_id` UUID validation so mock and live fail
 * identically with the shared normalized error envelope. An unknown-but-valid
 * ticket is a 404 checked by the fetch layer.
 */
export function validateUploadOverviewArgs(uploadId: string): void {
  if (!UUID_PATTERN.test(uploadId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid upload id.",
      details: [{ field: "upload_id", message: "upload_id must be a valid UUID" }],
    });
  }
}

/**
 * Derive a single-ticket snapshot exactly as the backend repository does.
 * `uploadId` is assumed to exist (the fetch layer rejects unknown tickets); an
 * unseeded ticket throws the shared 404 envelope. The project name is joined
 * when present, with a stable fallback for an orphan ticket. Whole-project
 * counts reuse the `/uploads/stats` per-project bucket, byte signals are pure
 * derivations and `expired` compares the injected clock against the TTL.
 */
export function deriveUploadOverview(
  uploadId: string,
  records: readonly UploadFeedRecord[],
  projects: readonly Project[],
  now: string,
): UploadOverview {
  const record = records.find((candidate) => candidate.upload_id === uploadId);
  if (!record) {
    throw new ApiError({
      status: 404,
      code: "upload_not_found",
      message: `Upload '${uploadId}' was not found.`,
    });
  }

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const projectRecords = records.filter((item) => item.project_id === record.project_id);
  const projectCompleted = projectRecords.filter((item) => item.status === "complete");

  return {
    upload_id: record.upload_id,
    project_id: record.project_id,
    project_name: projectNames.get(record.project_id) ?? UNKNOWN_UPLOAD_OVERVIEW_PROJECT_NAME,
    filename: record.filename,
    content_type: record.content_type,
    status: record.status,
    declared_size: record.declared_size,
    size_bytes: record.size_bytes,
    bytes_remaining: Math.max(0, record.declared_size - record.size_bytes),
    progress:
      record.declared_size > 0
        ? Math.min(1.0, record.size_bytes / record.declared_size)
        : 0.0,
    expired: now > record.expires_at,
    created_at: record.created_at,
    expires_at: record.expires_at,
    counts: {
      project_tickets: projectRecords.length,
      project_completed: projectCompleted.length,
      project_bytes_uploaded: projectCompleted.reduce((sum, item) => sum + item.size_bytes, 0),
    },
    generated_at: now,
  };
}
