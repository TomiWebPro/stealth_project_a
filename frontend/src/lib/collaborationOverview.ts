/**
 * Authoritative single collaboration-signal overview derivation + query helpers
 * (C294 follow-up).
 *
 * The backend (`CollaborationOverviewRepository`) derives the whole snapshot
 * fresh from the same canonical feed derivation as `/collaboration/feed` (which
 * shares the presence/comment stores `/collaboration/stats` aggregates); there is
 * no second index to drift. A signal is addressed by its stable composite
 * `<signal>:<project_id>:<signal_id>` key (presence is keyed by project + acting
 * user, a comment by its comment id), its project-scoped `by_state` buckets and
 * totals use the canonical `PresenceState` set / `PresenceStateCount` shape, and
 * its sibling page reuses the canonical `CollaborationFeedItem` wire shape — so
 * this view can never disagree with the feed or the stats snapshot.
 *
 * A malformed key (unknown signal, missing/extra components or a non-UUID id)
 * uses the shared 422 `validation_error` envelope; a well-formed key with no
 * matching live signal raises 404 `collaboration_signal_not_found` in the fetch
 * layer and is normalized to `undefined` by both transports. `counts` describe
 * whole scopes and are never bounded by `recent_limit`. `lib/collaborationOverview`
 * reproduces that derivation over the same seeds so mock mode stays at feature
 * parity with live mode and the parity guard can drive both transports over
 * identical data.
 */

import { ApiError } from "../api/client";
import { COLLABORATION_SIGNALS, deriveCollaborationFeed } from "./collaborationFeed";
import { PRESENCE_STATES } from "./collaborationStats";
import type {
  CollaborationFeedItem,
  CollaborationOverview,
  CollaborationSignal,
  Comment,
  Presence,
  PresenceStateCount,
  Project,
} from "./types";

/** Optional page bound mirrored from the authoritative `/collaboration/{key}/overview` endpoint. */
export interface CollaborationOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface CollaborationOverviewSeeds {
  readonly presences: readonly Presence[];
  readonly comments: readonly Comment[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

/** Stable fallback for a signal whose project is no longer in the store. */
export const UNKNOWN_COLLABORATION_OVERVIEW_PROJECT_NAME = "Unknown project";
export const DEFAULT_COLLABORATION_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEPARATOR = ":";
// The feed page is capped at the HTTP layer; the repository uses an effectively
// unlimited limit so every derived signal is available for counts and siblings.
const ALL_SIGNALS = 1_000_000_000;

/** Build the composite key the backend addresses a signal by. */
export function buildCollaborationSignalKey(
  signal: CollaborationSignal,
  projectId: string,
  signalId: string,
): string {
  return `${signal}${SEPARATOR}${projectId}${SEPARATOR}${signalId}`;
}

/**
 * Mirror the router/repository validation so mock and live fail identically with
 * the shared normalized error envelope: the key must be
 * `<signal>:<project-id>:<signal-id>` with a known signal and two UUIDs, and
 * `recent_limit` must be within 1..50. A well-formed key with no matching signal
 * is a 404 checked by the fetch/derivation layer.
 */
export function validateCollaborationOverviewArgs(
  signalKey: string,
  options: CollaborationOverviewOptions = {},
): void {
  const parts = signalKey.split(SEPARATOR);
  if (parts.length !== 3 || parts.some((part) => part.length === 0) ||
      !COLLABORATION_SIGNALS.includes(parts[0] as CollaborationSignal)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: `Malformed collaboration signal key '${signalKey}'.`,
      details: [
        {
          field: "signal_key",
          message: "Expected '<signal>:<project-id>:<signal-id>' with a known signal",
        },
      ],
    });
  }
  const uuidFields = ["project_id", "signal_id"] as const;
  for (const [index, field] of uuidFields.entries()) {
    if (!UUID_PATTERN.test(parts[index + 1] ?? "")) {
      throw new ApiError({
        status: 422,
        code: "validation_error",
        message: `Malformed collaboration signal key '${signalKey}'.`,
        details: [{ field, message: "Expected a UUID" }],
      });
    }
  }
  const { recentLimit } = options;
  if (
    recentLimit !== undefined &&
    (!Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > MAX_RECENT_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Collaboration overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/** Python-compatible descending comparison of the canonical feed sort key. */
function compareNewest(a: CollaborationFeedItem, b: CollaborationFeedItem): number {
  if (a.occurred_at !== b.occurred_at) return a.occurred_at > b.occurred_at ? -1 : 1;
  const aId = String(a.signal_id);
  const bId = String(b.signal_id);
  if (aId !== bId) return aId > bId ? -1 : 1;
  if (a.signal !== b.signal) return a.signal > b.signal ? -1 : 1;
  if (a.project_id !== b.project_id) return a.project_id > b.project_id ? -1 : 1;
  return 0;
}

/**
 * Derive a single-collaboration-signal snapshot exactly as the backend
 * repository does. The canonical collaboration-feed projection (unbounded here)
 * supplies every workspace signal, so the identity, joined project name,
 * project-scoped counts and sibling ordering are shared with `/collaboration/feed`
 * and `/collaboration/stats` and cannot drift. An unknown signal throws the
 * shared `collaboration_signal_not_found` 404. Whole-scope counts are never
 * bounded by the sibling page.
 */
export function deriveCollaborationOverview(
  signalKey: string,
  seeds: CollaborationOverviewSeeds,
  options: CollaborationOverviewOptions = {},
): CollaborationOverview {
  const [rawSignal, rawProject, rawSignalId] = signalKey.split(SEPARATOR);
  const feed = deriveCollaborationFeed(seeds.presences, seeds.comments, seeds.projects, seeds.now, {
    limit: ALL_SIGNALS,
  });
  const items = feed.items ?? [];
  const signal = items.find(
    (item) =>
      item.signal === rawSignal &&
      item.project_id === rawProject &&
      item.signal_id === rawSignalId,
  );
  if (!signal) {
    throw new ApiError({
      status: 404,
      code: "collaboration_signal_not_found",
      message: `Collaboration signal '${signalKey}' was not found.`,
    });
  }

  const projectNames = new Map(seeds.projects.map((project) => [project.id, project.name]));
  const projectSignals = items.filter((item) => item.project_id === signal.project_id);

  const stateCounts = new Map<string, number>();
  for (const item of projectSignals) {
    if (item.signal === "presence" && item.state) {
      stateCounts.set(item.state, (stateCounts.get(item.state) ?? 0) + 1);
    }
  }
  const byState: PresenceStateCount[] = PRESENCE_STATES.map((state) => ({
    state,
    count: stateCounts.get(state) ?? 0,
  }));

  const participants = new Set(projectSignals.map((item) => item.actor_id));
  // deriveCollaborationFeed sorts newest-first; re-sort explicitly to mirror the
  // repository's deterministic sibling ordering.
  const siblings = [...projectSignals].sort(compareNewest);
  const { recentLimit = DEFAULT_COLLABORATION_OVERVIEW_RECENT_LIMIT } = options;

  return {
    signal_id: signal.signal_id,
    signal: signal.signal,
    project_id: signal.project_id,
    project_name: projectNames.get(signal.project_id) ?? UNKNOWN_COLLABORATION_OVERVIEW_PROJECT_NAME,
    actor_id: signal.actor_id,
    state: signal.state,
    body: signal.body,
    asset_id: signal.asset_id,
    occurred_at: signal.occurred_at,
    counts: {
      project_signals: projectSignals.length,
      project_presence: projectSignals.filter((item) => item.signal === "presence").length,
      project_comments: projectSignals.filter((item) => item.signal === "comment").length,
      project_participants: participants.size,
      workspace_signals: feed.total,
      by_state: byState,
    },
    recent_signals: siblings.slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/collaboration/{id}/overview` request. */
export function collaborationOverviewQueryParams(
  options: CollaborationOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
