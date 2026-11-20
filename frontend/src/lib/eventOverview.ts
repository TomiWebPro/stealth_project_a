/**
 * Authoritative single job-event overview derivation + query helpers (C274
 * follow-up).
 *
 * The backend (`EventOverviewRepository`) derives the whole snapshot fresh from
 * its authoritative job, event and project stores on every call — there is no
 * second index. It projects one event's identity/context (joined to its parent
 * job for the operation/project identity), zero-filled whole-job `by_type`
 * counts (the canonical buckets from `/events/stats`) and a bounded
 * newest-sibling-first page with a deterministic `(timestamp, seq)` tie-break.
 * The project-name fallback reuses the rule from `/events/feed`, so the snapshot
 * cannot disagree with those views.
 *
 * Only events belonging to the requested job contribute to the counts and the
 * sibling page; an event sequence from another job is never mistaken for one in
 * this job. `counts` describe the whole job and are never bounded by
 * `recent_limit`.
 *
 * An unknown job is a 404 (`job_not_found`) and a sequence absent from that job
 * is a separate 404 (`event_not_found`), both normalized to `undefined` by the
 * transports; a malformed id/sequence or an invalid `recent_limit` uses the
 * shared 422 envelope.
 *
 * `lib/eventOverview` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data.
 */

import { ApiError } from "../api/client";
import { UNKNOWN_EVENT_PROJECT_NAME } from "./eventFeed";
import { JOB_EVENT_TYPES } from "./eventStats";
import type { EventOverview, Job, JobEvent, Project } from "./types";

/** Optional page bound mirrored from the authoritative `/jobs/{id}/events/{seq}/overview` endpoint. */
export interface EventOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface EventOverviewSeeds {
  readonly jobs: readonly Job[];
  readonly events: readonly JobEvent[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_EVENT_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (a well-formed job id, a non-negative integer
 * sequence and `recent_limit` ge=1, le=50) so mock and live fail identically
 * with the shared normalized error envelope. Unknown-but-valid ids are 404s
 * checked by the fetch layer.
 */
export function validateEventOverviewArgs(
  jobId: string,
  seq: number,
  options: EventOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(jobId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid job id.",
      details: [{ field: "job_id", message: "job_id must be a valid UUID" }],
    });
  }
  if (!Number.isInteger(seq) || seq < 0) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Event sequence must be a non-negative integer.",
      details: [{ field: "seq", message: "seq must be a non-negative integer" }],
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
      message: "Event overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-event snapshot exactly as the backend repository does.
 * `jobId` is assumed to exist (the fetch layer rejects unknown jobs). Only
 * events in that job are considered: they are counted into zero-filled `by_type`
 * buckets over the whole set and emitted newest-first as the bounded sibling
 * page. A sequence absent from the job throws an `event_not_found` 404.
 */
export function deriveEventOverview(
  jobId: string,
  seq: number,
  seeds: EventOverviewSeeds,
  options: EventOverviewOptions = {},
): EventOverview {
  const job = seeds.jobs.find((candidate) => candidate.id === jobId);
  if (!job) {
    throw new ApiError({
      status: 404,
      code: "job_not_found",
      message: `Job '${jobId}' was not found.`,
    });
  }

  const project = seeds.projects.find((candidate) => candidate.id === job.project_id);
  const projectName = project?.name ?? UNKNOWN_EVENT_PROJECT_NAME;

  const events = seeds.events.filter((event) => event.job_id === jobId);
  const target = events.find((event) => event.seq === seq);
  if (!target) {
    throw new ApiError({
      status: 404,
      code: "event_not_found",
      message: `Event '${seq}' was not found.`,
    });
  }

  const typeCounts = new Map<string, number>();
  for (const type of JOB_EVENT_TYPES) typeCounts.set(type, 0);
  for (const event of events) {
    typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);
  }

  const counts: EventOverview["counts"] = {
    total: events.length,
    by_type: JOB_EVENT_TYPES.map((type) => ({ type, count: typeCounts.get(type) ?? 0 })),
  };

  const newestFirst = [...events].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp) || b.seq - a.seq,
  );
  const { recentLimit = DEFAULT_EVENT_OVERVIEW_RECENT_LIMIT } = options;

  return {
    job_id: job.id,
    seq: target.seq,
    type: target.type,
    operation_id: job.operation_id,
    project_id: job.project_id,
    project_name: projectName,
    status: target.status,
    progress: target.progress,
    message: target.message,
    asset_id: target.asset_id,
    error: target.error,
    timestamp: target.timestamp,
    counts,
    recent_siblings: newestFirst.slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/jobs/{id}/events/{seq}/overview` request. */
export function eventOverviewQueryParams(
  options: EventOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
