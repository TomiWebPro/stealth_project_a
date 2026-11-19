/**
 * Authoritative job event stream statistics derivation + query helpers (C101
 * follow-up).
 *
 * The backend (`EventStatsRepository`) keeps no second index: it derives the
 * whole snapshot from the authoritative `JOB_EVENTS` collection on every call,
 * zero-fills `by_type` over the canonical `JobEventType` values, builds a
 * deterministic per-job breakdown and takes the newest event's timestamp as the
 * recency marker. An optional `project_id` scope joins events to their parent
 * jobs, so events from unknown/removed jobs are skipped. `lib/eventStats`
 * reproduces that derivation over the same seeds so mock mode stays at feature
 * parity with live mode and the parity guard can drive both transports over
 * identical data.
 */

import { ApiError } from "../api/client";
import type { EventJobCount, EventStats, EventTypeCount, Job, JobEventType } from "./types";

/** Optional scope mirrored from the authoritative `/events/stats` endpoint. */
export interface EventStatsOptions {
  readonly projectId?: string;
}

/**
 * Minimal event shape shared by the authoritative job-event documents. Only
 * the type/job/timestamp fields feed the statistics derivation; keeping the
 * seed shape small avoids duplicating unrelated job-event wire contracts.
 */
export interface JobEventRecord {
  readonly type: JobEventType;
  readonly job_id: string;
  readonly timestamp: string;
}

/** Canonical event types in their documented order, matching `get_args(JobEventType)`. */
export const JOB_EVENT_TYPES: readonly JobEventType[] = [
  "status",
  "progress",
  "intermediate",
  "result",
  "error",
  "log",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live fail
 * identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validateEventStatsArgs(options: EventStatsOptions = {}): void {
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
 * Derive job-event metrics exactly as the backend repository does: a zero-filled
 * per-type breakdown, per-job event activity sorted by descending count then job
 * id, the count of emitting jobs and the newest event's timestamp as recency. A
 * project scope attributes an event only when its parent job still exists and
 * belongs to that project (orphan events are skipped); an empty scope yields
 * zero counts, zero-filled buckets, an empty per-job breakdown and a `null`
 * recency marker (never an error).
 */
export function deriveEventStats(
  events: readonly JobEventRecord[],
  jobs: readonly Job[],
  now: string,
  options: EventStatsOptions = {},
): EventStats {
  const jobProjects = new Map<string, string>();
  for (const job of jobs) jobProjects.set(job.id, job.project_id);

  const scoped = options.projectId
    ? events.filter((event) => jobProjects.get(event.job_id) === options.projectId)
    : events;

  const typeCounts = new Map<JobEventType, number>();
  for (const type of JOB_EVENT_TYPES) typeCounts.set(type, 0);

  const perJob = new Map<string, [number, string]>();
  let newest: string | null = null;
  for (const event of scoped) {
    typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);

    const bucket = perJob.get(event.job_id) ?? [0, event.timestamp];
    bucket[0] += 1;
    if (event.timestamp > (bucket[1] ?? "")) bucket[1] = event.timestamp;
    perJob.set(event.job_id, bucket);

    if (newest === null || event.timestamp > newest) newest = event.timestamp;
  }

  const byType: EventTypeCount[] = JOB_EVENT_TYPES.map((type) => ({
    type,
    count: typeCounts.get(type) ?? 0,
  }));

  const byJob: EventJobCount[] = [...perJob.entries()]
    .map(([jobId, [count, timestamp]]) => ({
      job_id: jobId,
      events: count,
      newest_event_at: timestamp,
    }))
    .sort((a, b) => b.events - a.events || a.job_id.localeCompare(b.job_id));

  return {
    total_events: scoped.length,
    total_jobs: perJob.size,
    by_type: byType,
    by_job: byJob,
    newest_event_at: newest,
    generated_at: now,
  };
}

/** Query-string values for the live `/events/stats` request. */
export function eventStatsQueryParams(
  options: EventStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
