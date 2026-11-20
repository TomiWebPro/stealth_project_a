/**
 * Authoritative single-job overview derivation + query helpers (C213
 * follow-up).
 *
 * The backend (`JobOverviewRepository`) derives the whole snapshot fresh from
 * its authoritative job, event, retry-ledger and project stores on every call —
 * there is no second index. It projects one job's identity, cross-domain counts
 * (event total, accepted-retry total and a zero-filled event-type breakdown
 * reusing the canonical `JobEventType` values from `/events/stats`) and a bounded
 * newest-event-first list.
 *
 * `lib/jobOverview` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data. The event-type buckets reuse the canonical
 * values from `/events/stats`, so the overview cannot disagree with that
 * aggregate.
 *
 * An unknown job is a 404 checked by the fetch layer against the job seeds
 * (resolved to `undefined` by the transports); a malformed id or an out-of-range
 * `recent_limit` uses the shared 422 envelope.
 */

import { ApiError } from "../api/client";
import { JOB_EVENT_TYPES } from "./eventStats";
import type { JobRetryRecord } from "./retryStats";
import type { Job, JobEvent, JobOverview, Project } from "./types";

/** Optional page bound mirrored from the authoritative `/jobs/{id}/overview` endpoint. */
export interface JobOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface JobOverviewSeeds {
  readonly jobs: readonly Job[];
  readonly events: readonly JobEvent[];
  readonly retries: readonly JobRetryRecord[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

/** Stable display name used by the backend when a job's project is missing. */
export const UNKNOWN_JOB_OVERVIEW_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_JOB_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`job_id` UUID and `recent_limit` ge=1,
 * le=50) so mock and live fail identically with the shared normalized error
 * envelope. An unknown-but-valid job is a 404 checked by the fetch layer.
 */
export function validateJobOverviewArgs(jobId: string, options: JobOverviewOptions = {}): void {
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
      message: "Job overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-job snapshot exactly as the backend repository does.
 * `jobId` is assumed to exist (the fetch layer rejects unknown jobs); an
 * unseeded job yields a 404. Empty event/retry domains yield zero counts and an
 * empty recent-event list (never an error). Malformed ledger entries cannot be
 * attributed to this job and are skipped, matching the backend join.
 */
export function deriveJobOverview(
  jobId: string,
  seeds: JobOverviewSeeds,
  options: JobOverviewOptions = {},
): JobOverview {
  const job = seeds.jobs.find((candidate) => candidate.id === jobId);
  if (!job) {
    throw new ApiError({ status: 404, code: "not_found", message: "Job not found." });
  }

  const { recentLimit = DEFAULT_JOB_OVERVIEW_RECENT_LIMIT } = options;
  const project = seeds.projects.find((candidate) => candidate.id === job.project_id);
  const projectName = project?.name ?? UNKNOWN_JOB_OVERVIEW_PROJECT_NAME;

  // Matches the event-feed `(timestamp, job_id, seq)` newest-first rule; job_id
  // is constant here but kept for an identical ordering contract.
  const events = seeds.events
    .filter((event) => event.job_id === jobId)
    .sort(
      (a, b) =>
        b.timestamp.localeCompare(a.timestamp) ||
        b.job_id.localeCompare(a.job_id) ||
        b.seq - a.seq,
    );

  const typeCounts = new Map<string, number>();
  for (const event of events) {
    typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);
  }

  // One accepted retry per ledger entry; duplicates count separately (a job can
  // be retried more than once) while malformed/orphan entries are excluded.
  const retries = seeds.retries.filter(
    (entry) => UUID_PATTERN.test(entry.job_id) && entry.job_id === jobId,
  ).length;

  const counts = {
    events: events.length,
    retries,
    by_event_type: JOB_EVENT_TYPES.map((type) => ({ type, count: typeCounts.get(type) ?? 0 })),
  };

  return {
    job_id: job.id,
    project_id: job.project_id,
    project_name: projectName,
    operation_id: job.operation_id,
    schema_version: job.schema_version,
    status: job.status,
    progress: job.progress ?? 0,
    attempt: job.attempt ?? 0,
    created_by: job.created_by,
    created_at: job.created_at,
    started_at: job.started_at ?? null,
    finished_at: job.finished_at ?? null,
    result: job.result ?? null,
    error: job.error ?? null,
    counts,
    recent_events: events.slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/jobs/{id}/overview` request. */
export function jobOverviewQueryParams(
  options: JobOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
