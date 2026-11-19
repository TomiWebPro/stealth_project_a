/**
 * Authoritative job dispatch-queue derivation + query helpers (C121 follow-up).
 *
 * The backend (`JobQueueRepository`) keeps no second queue index: it derives the
 * active (queued + running) jobs fresh from the authoritative `JOBS` store on
 * every call, ordered FIFO by `(created_at, job_id)` for deterministic
 * cross-backend positions. Whole-queue counters describe the full filtered set
 * before paging. `lib/jobQueue` reproduces that derivation over the same seeds
 * so mock mode stays at feature parity with live mode and the parity guard can
 * drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Job, JobQueueEntry, JobQueueView, JobStatus } from "./types";

/** Optional scope mirrored from the authoritative `/jobs/queue` endpoint. */
export interface JobQueueOptions {
  readonly projectId?: string;
  readonly limit?: number;
}

/** The only lifecycle states that belong to the dispatch queue (C121). */
export const ACTIVE_QUEUE_STATUSES: readonly JobStatus[] = ["queued", "running"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id` or a `limit`
 * outside 1..200 is rejected with a 422. An unknown-but-valid project is a 404
 * checked by the fetch layer against the project seeds.
 */
export function validateJobQueueArgs(options: JobQueueOptions = {}): void {
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
      message: "Queue limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Derive the dispatch queue exactly as the backend repository does: filter to
 * active jobs (optionally scoped to one project), sort FIFO by `(created_at,
 * job_id)` ascending, label every entry with its 1-based position in the full
 * ordering, then apply the `limit` page. `total` / `waiting` / `running` count
 * the whole filtered queue before paging. An empty scope yields zero counters
 * and an empty `entries` array (never an error).
 */
export function deriveJobQueue(
  jobs: readonly Job[],
  now: string,
  options: JobQueueOptions = {},
): JobQueueView {
  const { projectId, limit = DEFAULT_LIMIT } = options;
  const active = jobs
    .filter(
      (job) =>
        ACTIVE_QUEUE_STATUSES.includes(job.status) &&
        (projectId === undefined || job.project_id === projectId),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

  const waiting = active.filter((job) => job.status === "queued").length;
  const running = active.filter((job) => job.status === "running").length;
  const entries: JobQueueEntry[] = active.slice(0, limit).map((job, index) => ({
    position: index + 1,
    job_id: job.id,
    operation_id: job.operation_id,
    status: job.status,
    project_id: job.project_id,
    created_at: job.created_at,
  }));

  return {
    total: active.length,
    waiting,
    running,
    entries,
    generated_at: now,
  };
}

/** Query-string values for the live `/jobs/queue` request. */
export function jobQueueQueryParams(
  options: JobQueueOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, limit: options.limit };
}
