/**
 * Authoritative workspace activity-feed derivation + query helpers (C29 follow-up).
 *
 * The backend (`ActivityRepository`) derives the whole feed from its authoritative
 * asset / job / comment stores on every call — there is no second activity log.
 * `lib/activity` reproduces that derivation exactly so mock mode stays at feature
 * parity with live mode and the parity guard can drive both transports over the
 * very same seeds.
 */

import { ApiError } from "../api/client";
import type { ActivityEvent, ActivityFeed, ActivityKind, Asset, Comment, Job } from "./types";

/** Optional filters mirrored from the authoritative `/activity` endpoint. */
export interface ActivityOptions {
  readonly projectId?: string;
  readonly kind?: ActivityKind;
  readonly limit?: number;
}

const VALID_KINDS: readonly ActivityKind[] = ["asset", "publish", "job", "comment"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Kept in sync with the audit/activity repositories and graphHelpers JOB_TONE. */
const JOB_TONES: Record<Job["status"], ActivityEvent["tone"]> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  canceled: "neutral",
};

/**
 * Mirror the router's 422 validation so mock and live fail identically: a
 * malformed `project_id`, an unknown `kind`, or a `limit` outside 1..200 are
 * rejected with the same normalized error envelope.
 */
export function validateActivityArgs(options: ActivityOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
  if (options.kind !== undefined && !VALID_KINDS.includes(options.kind)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid activity kind.",
      details: [{ field: "kind", message: "kind must be one of asset, publish, job, comment" }],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Activity limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Derive the newest-first feed exactly as the backend repository does: one
 * `asset` event per registered asset, an extra `publish` event for each receipt,
 * one `job` event per submitted job and one `comment` event per project comment.
 * `total` is the number of matches *before* the limit is applied.
 */
export function deriveActivityFeed(
  assets: readonly Asset[],
  jobs: readonly Job[],
  comments: readonly Comment[],
  options: ActivityOptions = {},
): ActivityFeed {
  const { projectId, kind, limit = DEFAULT_LIMIT } = options;
  const events: ActivityEvent[] = [];

  for (const asset of assets) {
    if (projectId && asset.project_id !== projectId) continue;
    events.push({
      id: `asset-${asset.id}`,
      kind: "asset",
      project_id: asset.project_id,
      actor_id: asset.creator_id,
      label: `Created ${asset.name}`,
      detail: asset.provenance?.operation_id ?? asset.type,
      timestamp: asset.created_at,
      tone: "info",
    });
    const receipt = asset.metadata?.["publish_receipt"];
    if (receipt && typeof receipt === "object") {
      const receiptData = receipt as Record<string, unknown>;
      const publisher = receiptData["publisher"];
      const comment = receiptData["comment"];
      events.push({
        id: `publish-${asset.id}`,
        kind: "publish",
        project_id: asset.project_id,
        actor_id: publisher ? String(publisher) : asset.creator_id,
        label: `Published ${asset.name}`,
        detail: typeof comment === "string" && comment ? comment : "Publish receipt recorded",
        timestamp: asset.updated_at,
        tone: "success",
      });
    }
  }

  for (const job of jobs) {
    if (projectId && job.project_id !== projectId) continue;
    events.push({
      id: `job-${job.id}`,
      kind: "job",
      project_id: job.project_id,
      actor_id: job.created_by,
      label: `${job.operation_id} · ${job.status}`,
      detail: job.error?.message ?? `Attempt ${job.attempt ?? 0}`,
      timestamp: job.created_at,
      tone: JOB_TONES[job.status] ?? "neutral",
    });
  }

  for (const comment of comments) {
    if (projectId && comment.project_id !== projectId) continue;
    events.push({
      id: `comment-${comment.id}`,
      kind: "comment",
      project_id: comment.project_id,
      actor_id: comment.author_id,
      label: "Commented on a project",
      detail: comment.body,
      timestamp: comment.created_at,
      tone: "accent",
    });
  }

  const filtered = kind ? events.filter((event) => event.kind === kind) : events;
  filtered.sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id),
  );
  return { events: filtered.slice(0, limit), total: filtered.length };
}

/** Query-string values for the live `/activity` request. */
export function activityQueryParams(
  options: ActivityOptions = {},
): Record<string, string | number | undefined> {
  return {
    project_id: options.projectId,
    kind: options.kind,
    limit: options.limit,
  };
}
