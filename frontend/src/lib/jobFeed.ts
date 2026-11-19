/**
 * Authoritative job feed derivation + query helpers (C141 follow-up).
 *
 * The backend (`JobFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of jobs fresh from the authoritative `JOBS`
 * collection — the same store `GET /jobs` lists, `GET /jobs/stats` aggregates
 * and `GET /jobs/queue` filters — so the feed can never drift from those views
 * or from what actually exists. Each item's project display name is joined from
 * the authoritative project store (with a stable fallback for a missing
 * project), ordering is by descending `(created_at, job_id)` so the wire shape
 * is byte-for-byte identical across the in-memory and SQLite stores, and
 * `total` counts the whole filtered feed before the `limit` page is applied.
 *
 * `lib/jobFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Job, JobFeed, JobFeedItem, JobStatus, Project } from "./types";

/** Optional scope/page/filter mirrored from the authoritative `/jobs/feed` endpoint. */
export interface JobFeedOptions {
  readonly projectId?: string;
  readonly status?: JobStatus;
  readonly limit?: number;
}

/** Kept in sync with the backend `JobStatus` enum (shared 422 on anything else). */
export const VALID_JOB_STATUSES: readonly JobStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
];

/** Stable display name used by the backend when a job's project is missing. */
export const UNKNOWN_JOB_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id`, an unknown
 * `status` or a `limit` outside 1..200 is rejected with a 422. An unknown-but-
 * valid project is a 404 checked by the fetch layer against the project seeds.
 */
export function validateJobFeedArgs(options: JobFeedOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
  if (options.status !== undefined && !VALID_JOB_STATUSES.includes(options.status)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid job status.",
      details: [
        {
          field: "status",
          message: "status must be one of queued, running, succeeded, failed, canceled",
        },
      ],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Job feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Derive the job feed exactly as the backend repository does: project each job,
 * optionally scope to one project and/or one lifecycle status, join project
 * names (falling back to a stable display name for missing projects), sort
 * newest-first with a job-id tie-break and apply the `limit` page. Missing
 * `progress`/`attempt` default to `0`/`1` and absent timestamps to `null`,
 * matching the backend schema. `total` counts the whole filtered feed before
 * paging. An empty scope yields an empty feed (never an error).
 */
export function deriveJobFeed(
  jobs: readonly Job[],
  projects: readonly Project[],
  now: string,
  options: JobFeedOptions = {},
): JobFeed {
  const { projectId, status, limit = DEFAULT_LIMIT } = options;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const items: JobFeedItem[] = [];
  for (const job of jobs) {
    if (projectId !== undefined && job.project_id !== projectId) continue;
    if (status !== undefined && job.status !== status) continue;
    items.push({
      job_id: job.id,
      project_id: job.project_id,
      project_name: projectNames.get(job.project_id) ?? UNKNOWN_JOB_PROJECT_NAME,
      operation_id: job.operation_id,
      status: job.status,
      progress: job.progress ?? 0,
      attempt: job.attempt ?? 1,
      created_by: job.created_by,
      created_at: job.created_at,
      started_at: job.started_at ?? null,
      finished_at: job.finished_at ?? null,
    });
  }

  items.sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) ||
      b.job_id.localeCompare(a.job_id),
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/jobs/feed` request. */
export function jobFeedQueryParams(
  options: JobFeedOptions = {},
): Record<string, string | number | undefined> {
  return {
    project_id: options.projectId,
    status: options.status,
    limit: options.limit,
  };
}
