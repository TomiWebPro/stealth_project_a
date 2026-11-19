/**
 * Authoritative activity statistics derivation + query helpers (C89 follow-up).
 *
 * The backend (`ActivityStatsRepository`) does not keep a second activity index:
 * it reuses the very same event derivation as the workspace activity feed
 * (`ActivityRepository.feed`) with an effectively unlimited limit, then aggregates
 * those events into a snapshot. `lib/activityStats` reproduces that derivation by
 * building the feed through `lib/activity`, so the feed and the snapshot can never
 * drift in mock mode either and the parity guard can drive both transports over
 * the same asset/job/comment seeds.
 */

import { ApiError } from "../api/client";
import { deriveActivityFeed } from "./activity";
import type {
  ActivityEvent,
  ActivityFeed,
  ActivityKind,
  ActivityStats,
  Asset,
  Comment,
  Job,
} from "./types";

/** Optional scope mirrored from the authoritative `/activity/stats` endpoint. */
export interface ActivityStatsOptions {
  readonly projectId?: string;
}

/** Canonical activity kinds, matching `get_args(ActivityKind)` on the backend. */
export const ACTIVITY_STAT_KINDS: readonly ActivityKind[] = ["asset", "publish", "job", "comment"];

/** The feed caps its HTTP page at 200; the repository asks for every event. */
export const ALL_ACTIVITY_EVENTS = 1_000_000_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live
 * fail identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validateActivityStatsArgs(
  options: ActivityStatsOptions = {},
): void {
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
 * Derive activity metrics exactly as the backend repository does: build the
 * newest-first feed over the authoritative stores (unlimited so totals and
 * breakdowns cover every event), zero-fill `by_kind` over the canonical kinds,
 * count distinct actors globally and per project, sort `by_project` by
 * descending event count then project id, and take the newest event as the
 * first entry of the sorted feed. An empty scope yields zero counts, zero-filled
 * kind buckets and `newest_event_at: null` (never an error).
 */
export function deriveActivityStats(
  assets: readonly Asset[],
  jobs: readonly Job[],
  comments: readonly Comment[],
  now: string,
  options: ActivityStatsOptions = {},
): ActivityStats {
  const feed: ActivityFeed = deriveActivityFeed(assets, jobs, comments, {
    ...(options.projectId ? { projectId: options.projectId } : {}),
    limit: ALL_ACTIVITY_EVENTS,
  });
  const events = feed.events ?? [];

  const kindCounts = new Map<ActivityKind, number>();
  const eventsByProject = new Map<string, number>();
  const actorsByProject = new Map<string, Set<string>>();
  const participants = new Set<string>();

  for (const event of events) {
    kindCounts.set(event.kind, (kindCounts.get(event.kind) ?? 0) + 1);
    eventsByProject.set(event.project_id, (eventsByProject.get(event.project_id) ?? 0) + 1);
    let actors = actorsByProject.get(event.project_id);
    if (!actors) {
      actors = new Set<string>();
      actorsByProject.set(event.project_id, actors);
    }
    actors.add(event.actor_id);
    participants.add(event.actor_id);
  }

  const byKind = ACTIVITY_STAT_KINDS.map((kind) => ({
    kind,
    count: kindCounts.get(kind) ?? 0,
  }));
  const byProject = [...eventsByProject.keys()]
    .map((projectId) => ({
      project_id: projectId,
      events: eventsByProject.get(projectId) ?? 0,
      participants: actorsByProject.get(projectId)?.size ?? 0,
    }))
    .sort(
      (a, b) => b.events - a.events || a.project_id.localeCompare(b.project_id),
    );

  // deriveActivityFeed sorts newest-first by (timestamp, id), so the first
  // event is exactly the backend's `max(events, key=(timestamp, id))`.
  const newestEvent: ActivityEvent | undefined = events[0];
  return {
    total_events: feed.total,
    total_participants: participants.size,
    by_kind: byKind,
    by_project: byProject,
    newest_event_at: newestEvent?.timestamp ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/activity/stats` request. */
export function activityStatsQueryParams(
  options: ActivityStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
