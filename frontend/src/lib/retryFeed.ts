/**
 * Authoritative job retry-feed derivation + query helpers (C193 follow-up).
 *
 * The backend (`RetryFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of retried jobs fresh from the authoritative
 * `JOB_RETRIES` idempotency ledger — the same store `/retries/stats` aggregates —
 * joined to `JOBS` for job identity/lifecycle and `PROJECTS` for display names.
 * The ledger is timestamp-free (one entry per accepted retry), so a job is
 * projected once with its total accepted-retry count and its recency signal is
 * the joined job's latest activity timestamp (created/started/finished) —
 * identical to `RetryStatsRepository.newest_retry_at`, so the feed and the
 * snapshot cannot disagree. Ledger entries whose job is missing (orphans) are
 * excluded, project names use a stable fallback, and ordering is by descending
 * `(retried_at, job_id)` for a deterministic cross-backend order. `total` counts
 * the whole filtered feed before the `limit` page is applied.
 *
 * An optional `project_id` scope filters after the join; an unknown-but-well-
 * formed project is a 404 checked by the fetch layer against the project seeds,
 * while a malformed id or invalid `limit` uses the shared 422 envelope.
 *
 * `lib/retryFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { JobRetryRecord } from "./retryStats";
import type { Job, Project, RetryFeed, RetryFeedItem } from "./types";

/** Optional scope/page bounds mirrored from the authoritative `/retries/feed` endpoint. */
export interface RetryFeedOptions {
  readonly projectId?: string;
  readonly limit?: number;
}

/** Stable display name used by the backend when a retried job's project is missing. */
export const UNKNOWN_RETRY_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id` or a `limit`
 * outside 1..200 is rejected with a 422. An unknown-but-valid project is a 404
 * checked by the fetch layer against the project seeds.
 */
export function validateRetryFeedArgs(options: RetryFeedOptions = {}): void {
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
      message: "Retry feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Derive the retry feed exactly as the backend repository does: count accepted
 * retries per job (skipping orphaned ledger entries), optionally scope to one
 * project, join project names with a stable fallback, take each retried job's
 * latest activity signal as its recency, sort newest-first with a `job_id`
 * tie-break and apply the `limit` page. `total` counts the whole filtered feed
 * before paging. An empty scope yields an empty feed (never an error).
 */
export function deriveRetryFeed(
  retries: readonly JobRetryRecord[],
  jobs: readonly Job[],
  projects: readonly Project[],
  now: string,
  options: RetryFeedOptions = {},
): RetryFeed {
  const { projectId, limit = DEFAULT_LIMIT } = options;

  const jobsById = new Map<string, Job>();
  for (const job of jobs) jobsById.set(job.id, job);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const retryCounts = new Map<string, number>();
  for (const entry of retries) {
    const job = jobsById.get(entry.job_id);
    if (job === undefined) continue; // orphaned ledger entry
    if (projectId !== undefined && job.project_id !== projectId) continue;
    retryCounts.set(entry.job_id, (retryCounts.get(entry.job_id) ?? 0) + 1);
  }

  const items: RetryFeedItem[] = [];
  for (const [jobId, count] of retryCounts) {
    const job = jobsById.get(jobId)!;
    // The ledger is timestamp-free: the joined job's latest activity signal is
    // the most accurate available recency marker for its retries.
    const signals = [job.created_at, job.started_at, job.finished_at].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (signals.length === 0) continue;
    let retriedAt = signals[0]!;
    for (const candidate of signals) if (candidate > retriedAt) retriedAt = candidate;

    items.push({
      job_id: job.id,
      project_id: job.project_id,
      project_name: projectNames.get(job.project_id) ?? UNKNOWN_RETRY_PROJECT_NAME,
      operation_id: job.operation_id,
      status: job.status,
      attempt: job.attempt ?? 1,
      retries: count,
      retried_at: retriedAt,
    });
  }

  items.sort(
    (a, b) =>
      b.retried_at.localeCompare(a.retried_at) || b.job_id.localeCompare(a.job_id),
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/retries/feed` request. */
export function retryFeedQueryParams(
  options: RetryFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, limit: options.limit };
}
