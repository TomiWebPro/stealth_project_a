/**
 * Authoritative single-activity-event overview derivation + query helpers (C290
 * follow-up).
 *
 * The backend (`ActivityOverviewRepository`) derives the whole snapshot fresh
 * from the same canonical event derivation as the workspace activity feed
 * (`/activity` and `/activity/stats`); there is no second index to drift. The
 * event is found by its stable `<kind>-<entity-id>` id, its project-scoped
 * `by_kind` buckets/totals use the exact derivation as `/activity/stats`, and
 * its sibling page reuses the canonical `ActivityEvent` wire shape — so this
 * view can never disagree with the feed or the snapshot.
 *
 * A malformed id (unknown kind prefix or a non-UUID entity id) uses the shared
 * 422 `validation_error` envelope; a well-formed id with no matching live event
 * raises 404 `activity_not_found` in the fetch layer and is normalized to
 * `undefined` by both transports. `counts` describe whole scopes and are never
 * bounded by `recent_limit`. `lib/activityOverview` reproduces that derivation
 * over the same seeds so mock mode stays at feature parity with live mode and
 * the parity guard can drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import { deriveActivityFeed } from "./activity";
import { ACTIVITY_STAT_KINDS, ALL_ACTIVITY_EVENTS } from "./activityStats";
import type {
  ActivityKind,
  ActivityOverview,
  Asset,
  Comment,
  Job,
  Project,
} from "./types";

/** Optional page bound mirrored from the authoritative `/activity/{id}/overview` endpoint. */
export interface ActivityOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface ActivityOverviewSeeds {
  readonly assets: readonly Asset[];
  readonly jobs: readonly Job[];
  readonly comments: readonly Comment[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

/** Stable fallback for an event whose project is no longer in the store. */
export const UNKNOWN_ACTIVITY_OVERVIEW_PROJECT_NAME = "Unknown project";
export const DEFAULT_ACTIVITY_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_KINDS: readonly string[] = ACTIVITY_STAT_KINDS;

/**
 * Mirror the router/repository validation so mock and live fail identically with
 * the shared normalized error envelope: the id must be `<kind>-<uuid>` with a
 * known kind, and `recent_limit` must be within 1..50. A well-formed id with no
 * matching event is a 404 checked by the fetch layer.
 */
export function validateActivityOverviewArgs(
  eventId: string,
  options: ActivityOverviewOptions = {},
): void {
  const separatorIndex = eventId.indexOf("-");
  const prefix = separatorIndex === -1 ? eventId : eventId.slice(0, separatorIndex);
  const rawEntity = separatorIndex === -1 ? "" : eventId.slice(separatorIndex + 1);
  if (!VALID_KINDS.includes(prefix) || !UUID_PATTERN.test(rawEntity)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Malformed activity event id.",
      details: [{ field: "event_id", message: "Expected '<kind>-<uuid>' with a known kind" }],
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
      message: "Activity overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-activity snapshot exactly as the backend repository does. The
 * canonical activity-feed projection (unbounded here) supplies every workspace
 * event, so the identity, kind/participant counts, recency and sibling ordering
 * are shared with `/activity` and `/activity/stats` and cannot drift. An unknown
 * event throws the shared `activity_not_found` 404. Whole-scope counts are never
 * bounded by the sibling page.
 */
export function deriveActivityOverview(
  eventId: string,
  seeds: ActivityOverviewSeeds,
  options: ActivityOverviewOptions = {},
): ActivityOverview {
  const feed = deriveActivityFeed(seeds.assets, seeds.jobs, seeds.comments, {
    limit: ALL_ACTIVITY_EVENTS,
  });
  const events = feed.events ?? [];
  const event = events.find((candidate) => candidate.id === eventId);
  if (!event) {
    throw new ApiError({
      status: 404,
      code: "activity_not_found",
      message: `Activity event '${eventId}' was not found.`,
    });
  }

  const projectNames = new Map(seeds.projects.map((project) => [project.id, project.name]));
  const projectEvents = events.filter((candidate) => candidate.project_id === event.project_id);

  const kindCounts = new Map<ActivityKind, number>();
  const participants = new Set<string>();
  for (const candidate of projectEvents) {
    kindCounts.set(candidate.kind, (kindCounts.get(candidate.kind) ?? 0) + 1);
    participants.add(candidate.actor_id);
  }
  const byKind = ACTIVITY_STAT_KINDS.map((kind) => ({
    kind,
    count: kindCounts.get(kind) ?? 0,
  }));

  // deriveActivityFeed sorts newest-first by (timestamp, id); re-sort explicitly
  // to mirror the repository's deterministic sibling ordering.
  const siblings = [...projectEvents].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id),
  );
  const { recentLimit = DEFAULT_ACTIVITY_OVERVIEW_RECENT_LIMIT } = options;

  return {
    id: event.id,
    kind: event.kind,
    project_id: event.project_id,
    project_name: projectNames.get(event.project_id) ?? UNKNOWN_ACTIVITY_OVERVIEW_PROJECT_NAME,
    actor_id: event.actor_id,
    label: event.label,
    detail: event.detail,
    timestamp: event.timestamp,
    tone: event.tone,
    counts: {
      total_events: projectEvents.length,
      total_participants: participants.size,
      workspace_events: feed.total,
      by_kind: byKind,
    },
    recent_events: siblings.slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/activity/{id}/overview` request. */
export function activityOverviewQueryParams(
  options: ActivityOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
