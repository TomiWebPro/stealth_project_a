/**
 * Authoritative comment feed derivation + query helpers (C149 follow-up).
 *
 * The backend (`CommentFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of comments fresh from the authoritative
 * `COMMENTS` collection — the same store the `GET|POST /comments` router reads
 * and writes and collaboration statistics aggregates — so the feed can never
 * drift from that view or from what actually exists. Each item's project display
 * name is joined from the authoritative project store (with a stable fallback
 * for a missing project), ordering is by descending `(created_at, comment_id)`
 * so the wire shape is byte-for-byte identical across the in-memory and SQLite
 * stores, and `total` counts the whole filtered feed before the `limit` page is
 * applied.
 *
 * An optional `project_id` scopes the same derivation to one project; an
 * unknown-but-well-formed project is a 404 checked by the fetch layer against
 * the project seeds, while a malformed id or invalid `limit` uses the shared
 * 422 envelope.
 *
 * `lib/commentFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Comment, CommentFeed, CommentFeedItem, Project } from "./types";

/** Optional scope + page bounds mirrored from the authoritative `/comments/feed` endpoint. */
export interface CommentFeedOptions {
  readonly projectId?: string;
  readonly limit?: number;
}

/** Stable display name used by the backend when a comment's project is missing. */
export const UNKNOWN_COMMENT_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `project_id` or a `limit`
 * outside 1..200 is rejected with a 422. An unknown-but-valid project is a 404
 * checked by the fetch layer against the project seeds.
 */
export function validateCommentFeedArgs(options: CommentFeedOptions = {}): void {
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
      message: "Feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Derive the comment feed exactly as the backend repository does: project each
 * comment, optionally scope to one project, join project names (falling back to
 * a stable display name for missing projects), sort newest-first with a
 * comment-id tie-break and apply the `limit` page. `asset_id` is normalized to
 * `null` when absent, matching the backend schema. `total` counts the whole
 * filtered feed before paging. An empty scope yields an empty feed (never an
 * error).
 */
export function deriveCommentFeed(
  comments: readonly Comment[],
  projects: readonly Project[],
  now: string,
  options: CommentFeedOptions = {},
): CommentFeed {
  const { projectId, limit = DEFAULT_LIMIT } = options;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  const items: CommentFeedItem[] = [];
  for (const comment of comments) {
    if (projectId !== undefined && comment.project_id !== projectId) continue;
    items.push({
      comment_id: comment.id,
      project_id: comment.project_id,
      project_name: projectNames.get(comment.project_id) ?? UNKNOWN_COMMENT_PROJECT_NAME,
      asset_id: comment.asset_id ?? null,
      author_id: comment.author_id,
      body: comment.body,
      created_at: comment.created_at,
    });
  }

  items.sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) ||
      b.comment_id.localeCompare(a.comment_id),
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/comments/feed` request. */
export function commentFeedQueryParams(
  options: CommentFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, limit: options.limit };
}
