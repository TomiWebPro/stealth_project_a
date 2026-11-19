/**
 * Authoritative job retry statistics derivation + query helpers (C105
 * follow-up).
 *
 * The backend (`RetryStatsRepository`) keeps no second index: it derives the
 * whole snapshot from the authoritative `JOB_RETRIES` idempotency ledger joined
 * to `JOBS` for project attribution and job status. One ledger entry is written
 * per accepted retry, so a job retried twice contributes two entries; entries
 * whose job no longer exists (orphans) cannot be attributed and are excluded
 * from every view. `by_status` is zero-filled over the canonical `JobStatus`
 * values, `by_project` is sorted by descending retry count then project id, and
 * the recency marker is the newest created/started/finished signal of any
 * retried job (the ledger itself is timestamp-free). An optional `project_id`
 * scope filters after the join. `lib/retryStats` reproduces that derivation over
 * the same seeds so mock mode stays at feature parity with live mode and the
 * parity guard can drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Job, JobStatus, RetryStats, RetryStatusCount, RetryProjectCount } from "./types";

/** Optional scope mirrored from the authoritative `/retries/stats` endpoint. */
export interface RetryStatsOptions {
  readonly projectId?: string;
}

/** Minimal shape of one authoritative retry-ledger entry (a bare `job_id`). */
export interface JobRetryRecord {
  readonly job_id: string;
}

/** Canonical statuses in their documented order, matching `get_args(JobStatus)`. */
export const JOB_STATUSES: readonly JobStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live fail
 * identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validateRetryStatsArgs(options: RetryStatsOptions = {}): void {
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
 * Derive retry metrics exactly as the backend repository does: join each ledger
 * entry to a known job, drop orphans, count accepted retries per job, zero-fill
 * the per-status breakdown over the canonical statuses, build a deterministic
 * per-project breakdown (descending retries then project id) and take the newest
 * retried-job activity signal as recency. An empty scope yields zero counts,
 * zero-filled buckets, an empty per-project breakdown and a `null` recency
 * marker (never an error).
 */
export function deriveRetryStats(
  retries: readonly JobRetryRecord[],
  jobs: readonly Job[],
  now: string,
  options: RetryStatsOptions = {},
): RetryStats {
  const jobsById = new Map<string, Job>();
  for (const job of jobs) jobsById.set(job.id, job);

  const retryCounts = new Map<string, number>();
  const retriedJobs = new Map<string, Job>();
  for (const entry of retries) {
    const job = jobsById.get(entry.job_id);
    if (job === undefined) continue; // orphaned ledger entry
    if (options.projectId !== undefined && job.project_id !== options.projectId) continue;
    retryCounts.set(entry.job_id, (retryCounts.get(entry.job_id) ?? 0) + 1);
    retriedJobs.set(entry.job_id, job);
  }

  const statusCounts = new Map<JobStatus, number>();
  for (const status of JOB_STATUSES) statusCounts.set(status, 0);

  const perProject = new Map<string, [number, number]>(); // [retries, jobs]
  let newest: string | null = null;
  for (const [jobId, job] of retriedJobs) {
    statusCounts.set(job.status, (statusCounts.get(job.status) ?? 0) + 1);

    const bucket = perProject.get(job.project_id) ?? [0, 0];
    bucket[0] += retryCounts.get(jobId) ?? 0;
    bucket[1] += 1;
    perProject.set(job.project_id, bucket);

    // The ledger is timestamp-free: use the joined job's latest activity signal.
    for (const candidate of [job.created_at, job.started_at, job.finished_at]) {
      if (candidate && (newest === null || candidate > newest)) newest = candidate;
    }
  }

  const byStatus: RetryStatusCount[] = JOB_STATUSES.map((status) => ({
    status,
    jobs: statusCounts.get(status) ?? 0,
  }));

  const byProject: RetryProjectCount[] = [...perProject.entries()]
    .map(([projectId, [count, jobCount]]) => ({
      project_id: projectId,
      retries: count,
      jobs: jobCount,
    }))
    .sort((a, b) => b.retries - a.retries || a.project_id.localeCompare(b.project_id));

  return {
    total_retries: [...retryCounts.values()].reduce((sum, count) => sum + count, 0),
    total_jobs: retriedJobs.size,
    by_status: byStatus,
    by_project: byProject,
    newest_retry_at: newest,
    generated_at: now,
  };
}

/** Query-string values for the live `/retries/stats` request. */
export function retryStatsQueryParams(
  options: RetryStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
