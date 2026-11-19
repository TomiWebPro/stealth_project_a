/**
 * Authoritative collaboration-feed derivation + query helpers (C197 follow-up).
 *
 * The backend (`CollaborationFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of collaboration signals fresh from the
 * authoritative `PRESENCE` and `COMMENTS` collections — the same stores the
 * presence/comment routers write and `/collaboration/stats` aggregates. A coarse
 * `signal` kind merges both record types onto one wire shape: a presence signal
 * carries its canonical state + last-seen time (with the acting user as its id),
 * a comment signal carries its body/optional asset + created time. Both are
 * projected with a joined project display name (stable "Unknown project" fallback)
 * and a unified `occurred_at` recency. Ordering is by descending
 * `(occurred_at, signal_id, signal, project_id)` for a deterministic cross-backend
 * order, and `total` counts the whole filtered feed before the `limit` page.
 *
 * An optional `project_id` scope filters after the projection; an unknown-but-
 * well-formed project is a 404 checked by the fetch layer against the project
 * seeds, while a malformed id, invalid `signal` or invalid `limit` uses the
 * shared 422 envelope.
 *
 * `lib/collaborationFeed` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type {
  CollaborationFeed,
  CollaborationFeedItem,
  CollaborationSignal,
  Comment,
  Presence,
  Project,
} from "./types";

/** Optional scope/filter/page bounds mirrored from the authoritative `/collaboration/feed` endpoint. */
export interface CollaborationFeedOptions {
  readonly projectId?: string;
  readonly signal?: CollaborationSignal;
  readonly limit?: number;
}

/** Canonical signal kinds, matching `get_args(CollaborationSignal)` on the backend. */
export const COLLABORATION_SIGNALS: readonly CollaborationSignal[] = ["presence", "comment"];

/** Stable display name used by the backend when a signal's project is missing. */
export const UNKNOWN_COLLABORATION_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id`, an unknown
 * `signal` or a `limit` outside 1..200 is rejected with a 422. An unknown-but-
 * valid project is a 404 checked by the fetch layer against the project seeds.
 */
export function validateCollaborationFeedArgs(options: CollaborationFeedOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
  if (options.signal !== undefined && !COLLABORATION_SIGNALS.includes(options.signal)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid collaboration signal.",
      details: [{ field: "signal", message: "signal must be presence or comment" }],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Collaboration feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Python-compatible descending comparison of the repository sort key
 * `(occurred_at, signal_id, signal, project_id)` — `String()` on the UUIDs keeps
 * ordering identical to the backend's `str(...)` projection.
 */
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
 * Derive the collaboration feed exactly as the backend repository does: project
 * presence and comment signals onto one shape (optionally narrowed by `signal`
 * and/or `projectId`), join project names with a stable fallback, sort newest-first
 * with a deterministic tie-break and apply the `limit` page. `total` counts the
 * whole filtered feed before paging. An empty scope yields an empty feed (never
 * an error).
 */
export function deriveCollaborationFeed(
  presences: readonly Presence[],
  comments: readonly Comment[],
  projects: readonly Project[],
  now: string,
  options: CollaborationFeedOptions = {},
): CollaborationFeed {
  const { projectId, signal, limit = DEFAULT_LIMIT } = options;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const items: CollaborationFeedItem[] = [];

  if (signal === undefined || signal === "presence") {
    for (const presence of presences) {
      if (projectId !== undefined && presence.project_id !== projectId) continue;
      items.push({
        signal_id: presence.user_id,
        signal: "presence",
        project_id: presence.project_id,
        project_name: projectNames.get(presence.project_id) ?? UNKNOWN_COLLABORATION_PROJECT_NAME,
        actor_id: presence.user_id,
        state: presence.state,
        body: null,
        asset_id: null,
        occurred_at: presence.last_seen_at,
      });
    }
  }

  if (signal === undefined || signal === "comment") {
    for (const comment of comments) {
      if (projectId !== undefined && comment.project_id !== projectId) continue;
      items.push({
        signal_id: comment.id,
        signal: "comment",
        project_id: comment.project_id,
        project_name: projectNames.get(comment.project_id) ?? UNKNOWN_COLLABORATION_PROJECT_NAME,
        actor_id: comment.author_id,
        state: null,
        body: comment.body,
        asset_id: comment.asset_id ?? null,
        occurred_at: comment.created_at,
      });
    }
  }

  items.sort(compareNewest);

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/collaboration/feed` request. */
export function collaborationFeedQueryParams(
  options: CollaborationFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, signal: options.signal, limit: options.limit };
}
