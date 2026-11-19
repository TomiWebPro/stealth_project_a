/**
 * Authoritative collaboration statistics derivation + query helpers (C81 follow-up).
 *
 * The backend (`CollaborationStatsRepository`) derives the whole snapshot from
 * the authoritative `PRESENCE` and `COMMENTS` stores on every call, with no
 * second index. `lib/collaborationStats` reproduces that derivation exactly so
 * mock mode stays at feature parity with live mode and the parity guard can
 * drive both transports over the same presence/comment seeds.
 */

import { ApiError } from "../api/client";
import type {
  CollaborationProjectCount,
  CollaborationStats,
  Comment,
  Presence,
  PresenceState,
  PresenceStateCount,
} from "./types";

/** Optional scope mirrored from the authoritative `/collaboration/stats` endpoint. */
export interface CollaborationStatsOptions {
  readonly projectId?: string;
}

/** Canonical presence states, matching `get_args(PresenceState)` on the backend. */
export const PRESENCE_STATES: readonly PresenceState[] = ["online", "away", "offline"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live
 * fail identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validateCollaborationStatsArgs(
  options: CollaborationStatsOptions = {},
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

/** Python-compatible `(last_seen_at, user_id, project_id)` recency comparison. */
function compareNewestPresence(a: Presence, b: Presence): number {
  if (a.last_seen_at !== b.last_seen_at) return a.last_seen_at > b.last_seen_at ? 1 : -1;
  if (a.user_id !== b.user_id) return a.user_id > b.user_id ? 1 : -1;
  if (a.project_id !== b.project_id) return a.project_id > b.project_id ? 1 : -1;
  return 0;
}

/** Python-compatible `(created_at, id)` recency comparison. */
function compareNewestComment(a: Comment, b: Comment): number {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? 1 : -1;
  if (a.id !== b.id) return a.id > b.id ? 1 : -1;
  return 0;
}

/**
 * Derive collaboration metrics exactly as the backend repository does: both
 * collections are filtered by the optional project scope with no join;
 * `by_state` is zero-filled over every canonical presence state; `by_project`
 * lists projects with any activity, sorted by descending comment count, then
 * presence count, then project id; `total_participants` is the distinct union of
 * present users and comment authors; both recency fields are `null` when their
 * collection is empty. An empty scope yields zero counts and zero-filled state
 * buckets (never an error).
 */
export function deriveCollaborationStats(
  presences: readonly Presence[],
  comments: readonly Comment[],
  now: string,
  options: CollaborationStatsOptions = {},
): CollaborationStats {
  let scopedPresences = presences.filter((presence) => presence.project_id !== undefined);
  let scopedComments = comments.filter((comment) => comment.project_id !== undefined);
  if (options.projectId) {
    scopedPresences = scopedPresences.filter((p) => p.project_id === options.projectId);
    scopedComments = scopedComments.filter((c) => c.project_id === options.projectId);
  }

  const stateCounts = new Map<PresenceState, number>();
  const presenceByProject = new Map<string, number>();
  const commentsByProject = new Map<string, number>();
  const participants = new Set<string>();
  let newestPresence: Presence | undefined;
  let newestComment: Comment | undefined;

  for (const presence of scopedPresences) {
    stateCounts.set(presence.state, (stateCounts.get(presence.state) ?? 0) + 1);
    presenceByProject.set(
      presence.project_id,
      (presenceByProject.get(presence.project_id) ?? 0) + 1,
    );
    participants.add(presence.user_id);
    if (!newestPresence || compareNewestPresence(presence, newestPresence) > 0) {
      newestPresence = presence;
    }
  }

  for (const comment of scopedComments) {
    commentsByProject.set(comment.project_id, (commentsByProject.get(comment.project_id) ?? 0) + 1);
    participants.add(comment.author_id);
    if (!newestComment || compareNewestComment(comment, newestComment) > 0) {
      newestComment = comment;
    }
  }

  const byState: PresenceStateCount[] = PRESENCE_STATES.map((state) => ({
    state,
    count: stateCounts.get(state) ?? 0,
  }));
  const projectIds = new Set([...presenceByProject.keys(), ...commentsByProject.keys()]);
  const byProject: CollaborationProjectCount[] = [...projectIds]
    .map((project_id) => ({
      project_id,
      comments: commentsByProject.get(project_id) ?? 0,
      presence: presenceByProject.get(project_id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.comments - a.comments ||
        b.presence - a.presence ||
        a.project_id.localeCompare(b.project_id),
    );

  return {
    total_presence: scopedPresences.length,
    total_comments: scopedComments.length,
    total_participants: participants.size,
    by_state: byState,
    by_project: byProject,
    newest_presence_at: newestPresence?.last_seen_at ?? null,
    newest_comment_at: newestComment?.created_at ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/collaboration/stats` request. */
export function collaborationStatsQueryParams(
  options: CollaborationStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
