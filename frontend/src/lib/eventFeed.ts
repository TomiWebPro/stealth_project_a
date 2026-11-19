/**
 * Authoritative job event-feed derivation + query helpers (C169 follow-up).
 *
 * The backend (`EventFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of job events fresh from the authoritative
 * `JOB_EVENTS` collection — the same store the SSE/polling endpoints read and
 * `EventStatsRepository` aggregates — so the feed can never drift from those
 * views. An event carries no project/operation identity of its own, so each item
 * is joined to its parent job from the authoritative `JOBS` store; orphan events
 * (missing parent job) are skipped (the same rule `/events/stats` uses for its
 * project scope). Project display names are joined from the authoritative
 * project store with a stable fallback, and ordering is by descending
 * `(timestamp, job_id, seq)` so the wire shape is byte-for-byte identical across
 * the in-memory and SQLite stores. `total` counts the whole filtered feed before
 * the `limit` page is applied.
 *
 * An optional `project_id`/`type` scopes the same derivation to one project
 * and/or event type; an unknown-but-well-formed project is a 404 checked by the
 * fetch layer against the project seeds, while a malformed id, unknown type or
 * invalid `limit` uses the shared 422 envelope.
 *
 * `lib/eventFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import { JOB_EVENT_TYPES } from "./eventStats";
import type { EventFeed, EventFeedItem, Job, JobEvent, JobEventType, Project } from "./types";

/** Optional scope/filter/page bounds mirrored from the authoritative `/events/feed` endpoint. */
export interface EventFeedOptions {
  readonly projectId?: string;
  readonly type?: JobEventType;
  readonly limit?: number;
}

/** Stable display name used by the backend when an event's project is missing. */
export const UNKNOWN_EVENT_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id`, an unknown event
 * `type` or a `limit` outside 1..200 is rejected with a 422. An unknown-but-valid
 * project is a 404 checked by the fetch layer against the project seeds.
 */
export function validateEventFeedArgs(options: EventFeedOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
  if (options.type !== undefined && !JOB_EVENT_TYPES.includes(options.type)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid event type.",
      details: [
        {
          field: "type",
          message: "type must be one of status, progress, intermediate, result, error, log",
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
      message: "Event feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Derive the event feed exactly as the backend repository does: join each event
 * to its parent job for operation/project identity (skipping orphans), optionally
 * scope to one project and/or event type, join project names (falling back to a
 * stable display name for missing projects), sort newest-first with a
 * `(job_id, seq)` tie-break and apply the `limit` page. Optional event fields are
 * normalized to `null`, matching the backend schema. `total` counts the whole
 * filtered feed before paging. An empty scope yields an empty feed (never an
 * error).
 */
export function deriveEventFeed(
  events: readonly JobEvent[],
  jobs: readonly Job[],
  projects: readonly Project[],
  now: string,
  options: EventFeedOptions = {},
): EventFeed {
  const { projectId, type, limit = DEFAULT_LIMIT } = options;

  const jobMeta = new Map<string, { operationId: string; projectId: string }>();
  for (const job of jobs) {
    jobMeta.set(job.id, { operationId: job.operation_id, projectId: job.project_id });
  }
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const items: EventFeedItem[] = [];
  for (const event of events) {
    const meta = jobMeta.get(event.job_id);
    if (meta === undefined) continue;
    if (projectId !== undefined && meta.projectId !== projectId) continue;
    if (type !== undefined && event.type !== type) continue;
    items.push({
      job_id: event.job_id,
      seq: event.seq,
      type: event.type,
      operation_id: meta.operationId,
      project_id: meta.projectId,
      project_name: projectNames.get(meta.projectId) ?? UNKNOWN_EVENT_PROJECT_NAME,
      status: event.status ?? null,
      progress: event.progress ?? null,
      message: event.message ?? null,
      asset_id: event.asset_id ?? null,
      error: event.error ?? null,
      timestamp: event.timestamp,
    });
  }

  items.sort(
    (a, b) =>
      b.timestamp.localeCompare(a.timestamp) ||
      b.job_id.localeCompare(a.job_id) ||
      b.seq - a.seq,
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/events/feed` request. */
export function eventFeedQueryParams(
  options: EventFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, type: options.type, limit: options.limit };
}
