/**
 * Authoritative job execution statistics derivation + query helpers (C40 follow-up).
 *
 * The backend (`JobStatsRepository`) derives the whole snapshot from the
 * authoritative job store on every call — there is no second index. `lib/jobStats`
 * reproduces that derivation exactly so mock mode stays at feature parity with
 * live mode and the parity guard can drive both transports over the same seeds.
 */

import { ApiError } from "../api/client";
import type { Job, JobStats, JobStatus, JobStatusCount, OperationJobStat } from "./types";

/** Optional scope mirrored from the authoritative `/jobs/stats` endpoint. */
export interface JobStatsOptions {
  readonly projectId?: string;
}

/** Canonical lifecycle order, matching `get_args(JobStatus)` on the backend. */
export const JOB_STATUSES: readonly JobStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's `project_id` validation (an optional UUID) so mock and
 * live fail identically with the shared normalized error envelope.
 */
export function validateJobStatsArgs(options: JobStatsOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
}

/** Python-compatible 3-decimal rounding for the derived ratios/means. */
function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/** Wall-clock seconds for a job with both timing endpoints, else `null`. */
function durationSeconds(job: Job): number | null {
  if (!job.started_at || !job.finished_at) return null;
  const start = Date.parse(job.started_at);
  const finish = Date.parse(job.finished_at);
  if (Number.isNaN(start) || Number.isNaN(finish)) return null;
  return Math.max(0, (finish - start) / 1000);
}

/**
 * Derive job execution metrics exactly as the backend repository does: a
 * zero-filled status breakdown, per-operation totals/outcomes ordered by total
 * then operation id, terminal-only success rate, in-flight/completed counts and
 * a mean duration over jobs carrying both timing endpoints. An empty scope
 * yields zero counts, empty arrays and a `null` average (never an error).
 */
export function deriveJobStats(
  jobs: readonly Job[],
  now: string,
  options: JobStatsOptions = {},
): JobStats {
  const scoped = options.projectId
    ? jobs.filter((job) => job.project_id === options.projectId)
    : jobs;

  const statusCounts: Record<string, number> = {};
  for (const status of JOB_STATUSES) statusCounts[status] = 0;
  for (const job of scoped) statusCounts[job.status] = (statusCounts[job.status] ?? 0) + 1;
  const byStatus: JobStatusCount[] = JOB_STATUSES.map((status) => ({
    status,
    count: statusCounts[status] ?? 0,
  }));

  const totals = new Map<string, number>();
  const succeeded = new Map<string, number>();
  const failed = new Map<string, number>();
  for (const job of scoped) {
    totals.set(job.operation_id, (totals.get(job.operation_id) ?? 0) + 1);
    if (job.status === "succeeded") {
      succeeded.set(job.operation_id, (succeeded.get(job.operation_id) ?? 0) + 1);
    } else if (job.status === "failed") {
      failed.set(job.operation_id, (failed.get(job.operation_id) ?? 0) + 1);
    }
  }
  const byOperation: OperationJobStat[] = [...totals.entries()]
    .map(([operation_id, total]) => ({
      operation_id,
      total,
      succeeded: succeeded.get(operation_id) ?? 0,
      failed: failed.get(operation_id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total || a.operation_id.localeCompare(b.operation_id));

  const successes = statusCounts["succeeded"] ?? 0;
  const failures = statusCounts["failed"] ?? 0;
  const terminal = successes + failures;
  const successRate = terminal ? round3(successes / terminal) : 0.0;
  const inFlight = (statusCounts["queued"] ?? 0) + (statusCounts["running"] ?? 0);
  const completed = terminal + (statusCounts["canceled"] ?? 0);

  const durations: number[] = [];
  for (const job of scoped) {
    const duration = durationSeconds(job);
    if (duration !== null) durations.push(duration);
  }
  const averageDuration = durations.length
    ? round3(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : null;

  return {
    total: scoped.length,
    by_status: byStatus,
    by_operation: byOperation,
    success_rate: successRate,
    in_flight: inFlight,
    completed,
    average_duration_seconds: averageDuration,
    generated_at: now,
  };
}

/** Query-string values for the live `/jobs/stats` request. */
export function jobStatsQueryParams(
  options: JobStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
