/**
 * Authoritative single-retried-job overview derivation + query helpers (C286
 * follow-up).
 *
 * The backend (`RetryOverviewRepository`) derives the whole snapshot fresh from
 * the authoritative `JOB_RETRIES` idempotency ledger — the same store
 * `/retries/stats` aggregates and `/retries/feed` projects — joined to `JOBS`
 * for job identity/lifecycle and `PROJECTS` for display names. There is no
 * second index. The sibling page reuses the exact `RetryFeedItem` projection
 * from `/retries/feed` (unbounded here), so receipt of this snapshot can never
 * disagree with the feed or the retry counts. Orphan ledger entries (whose job
 * no longer exists) are excluded everywhere, project names use a stable
 * fallback, and siblings are scoped to the target job's project, newest-first
 * with a deterministic `(retried_at, job_id)` tie-break. `counts` describe
 * whole scopes and are never bounded by `recent_limit`.
 *
 * An unknown job is a 404 `job_not_found`; a job with no accepted retries (or
 * no usable activity signal) is a 404 `retry_not_found`. Both are checked by
 * the fetch layer and normalized to `undefined` by the transports; a malformed
 * id or out-of-range `recent_limit` uses the shared 422 envelope.
 * `lib/retryOverview` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data.
 */

import { ApiError } from "../api/client";
import { deriveRetryFeed } from "./retryFeed";
import type { JobRetryRecord } from "./retryStats";
import type { Job, Project, RetryOverview } from "./types";

/** Optional page bound mirrored from the authoritative `/retries/{id}/overview` endpoint. */
export interface RetryOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface RetryOverviewSeeds {
  readonly retries: readonly JobRetryRecord[];
  readonly jobs: readonly Job[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_RETRY_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`job_id` UUID and `recent_limit` ge=1, le=50)
 * so mock and live fail identically with the shared normalized error envelope.
 * Unknown-but-valid jobs / jobs with no retries are 404s checked by the fetch
 * layer.
 */
export function validateRetryOverviewArgs(
  jobId: string,
  options: RetryOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(jobId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid job id.",
      details: [{ field: "job_id", message: "job_id must be a valid UUID" }],
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
      message: "Retry overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-retried-job snapshot exactly as the backend repository does.
 * The canonical retry-feed projection (unbounded here) supplies every retried
 * job sorted newest-first, so the retry counts, orphan exclusion, recency signal,
 * ordering and project-name joins are shared with `/retries/feed` and cannot
 * drift. An unknown job throws the shared `job_not_found` 404; a job absent from
 * the feed (no accepted retries / no activity signal) throws `retry_not_found`.
 * Whole-scope counts are never bounded by the sibling page.
 */
export function deriveRetryOverview(
  jobId: string,
  seeds: RetryOverviewSeeds,
  options: RetryOverviewOptions = {},
): RetryOverview {
  const target = seeds.jobs.find((candidate) => candidate.id === jobId);
  if (!target) {
    throw new ApiError({
      status: 404,
      code: "job_not_found",
      message: `Job '${jobId}' was not found.`,
    });
  }

  // A job that is not in the ledger has no accepted retries (orphan ledger
  // entries were already dropped by the shared canonical feed projection).
  const hasRetries = seeds.retries.some(
    (entry) => entry.job_id === jobId && seeds.jobs.some((job) => job.id === jobId),
  );
  if (!hasRetries) {
    throw new ApiError({
      status: 404,
      code: "retry_not_found",
      message: `No accepted retries for job '${jobId}'.`,
    });
  }

  const feed = deriveRetryFeed(seeds.retries, seeds.jobs, seeds.projects, seeds.now, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const items = feed.items ?? [];
  const targetItem = items.find((item) => item.job_id === jobId);
  if (!targetItem) {
    throw new ApiError({
      status: 404,
      code: "retry_not_found",
      message: `No accepted retries for job '${jobId}'.`,
    });
  }

  const { recentLimit = DEFAULT_RETRY_OVERVIEW_RECENT_LIMIT } = options;
  const siblings = items.filter((item) => item.project_id === target.project_id);

  return {
    job_id: targetItem.job_id,
    project_id: targetItem.project_id,
    project_name: targetItem.project_name,
    operation_id: targetItem.operation_id,
    status: targetItem.status,
    attempt: targetItem.attempt,
    retries: targetItem.retries,
    retried_at: targetItem.retried_at,
    counts: {
      project_retries: siblings.reduce((sum, item) => sum + item.retries, 0),
      project_jobs: siblings.length,
      total_retries: items.reduce((sum, item) => sum + item.retries, 0),
    },
    recent_siblings: siblings.slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/retries/{id}/overview` request. */
export function retryOverviewQueryParams(
  options: RetryOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
