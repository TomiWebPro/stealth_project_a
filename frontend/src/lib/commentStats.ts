/**
 * Authoritative comment-statistics derivation + query helpers (C165 follow-up).
 *
 * The backend (`CommentStatsRepository`) keeps no second index: it derives the
 * whole snapshot fresh from the authoritative `COMMENTS` collection — the same
 * store `GET|POST /comments` reads/writes and `GET /comments/feed` projects — so
 * the snapshot can never drift from that view. `by_reference` is zero-filled
 * over the canonical reference categories so the wire shape is byte-for-byte
 * identical across the in-memory and SQLite stores; `by_project` and
 * `by_author` are sorted by descending comment count then id for deterministic
 * cross-backend ordering.
 *
 * An optional `project_id` scopes the same derivation to one project; an
 * unknown-but-well-formed project is a 404 checked by the fetch layer against
 * the project seeds, while a malformed id uses the shared 422 envelope.
 *
 * `lib/commentStats` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data.
 */

import { ApiError } from "../api/client";
import type {
  Comment,
  CommentAuthorCount,
  CommentProjectCount,
  CommentReference,
  CommentReferenceCount,
  CommentStats,
} from "./types";

/** Optional scope mirrored from the authoritative `/comments/stats` endpoint. */
export interface CommentStatsOptions {
  readonly projectId?: string;
}

/**
 * Canonical reference categories, matching `get_args(CommentReference)` on the
 * backend (`Literal["asset", "project"]`). A comment with an `asset_id` counts
 * as an asset reference; otherwise it counts as a project reference.
 */
export const COMMENT_REFERENCES: readonly CommentReference[] = ["asset", "project"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live
 * fail identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is a 404 checked by the fetch layer, not a validation
 * error.
 */
export function validateCommentStatsArgs(options: CommentStatsOptions = {}): void {
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
 * Derive comment metrics exactly as the backend repository does: zero-filled
 * reference-category buckets, per-project comment/distinct-author counts and
 * per-author comment counts sorted by descending count then id, distinct totals
 * and newest-comment recency broken by the unique comment id. An empty scope
 * yields zero counts, zero-filled reference buckets, empty arrays and a `null`
 * recency (never an error).
 */
export function deriveCommentStats(
  comments: readonly Comment[],
  now: string,
  options: CommentStatsOptions = {},
): CommentStats {
  const scoped = options.projectId
    ? comments.filter((comment) => comment.project_id === options.projectId)
    : comments;

  const referenceCounts = new Map<CommentReference, number>();
  for (const reference of COMMENT_REFERENCES) referenceCounts.set(reference, 0);
  const commentsByProject = new Map<string, number>();
  const authorsByProject = new Map<string, Set<string>>();
  const commentsByAuthor = new Map<string, number>();

  for (const comment of scoped) {
    const reference: CommentReference = comment.asset_id != null ? "asset" : "project";
    referenceCounts.set(reference, (referenceCounts.get(reference) ?? 0) + 1);
    commentsByProject.set(comment.project_id, (commentsByProject.get(comment.project_id) ?? 0) + 1);
    let authors = authorsByProject.get(comment.project_id);
    if (!authors) {
      authors = new Set<string>();
      authorsByProject.set(comment.project_id, authors);
    }
    authors.add(comment.author_id);
    commentsByAuthor.set(comment.author_id, (commentsByAuthor.get(comment.author_id) ?? 0) + 1);
  }

  const byReference: CommentReferenceCount[] = COMMENT_REFERENCES.map((reference) => ({
    reference,
    count: referenceCounts.get(reference) ?? 0,
  }));

  const byProject: CommentProjectCount[] = [...commentsByProject.entries()]
    .map(([projectId, count]) => ({
      project_id: projectId,
      comments: count,
      authors: authorsByProject.get(projectId)?.size ?? 0,
    }))
    .sort((a, b) => b.comments - a.comments || a.project_id.localeCompare(b.project_id));

  const byAuthor: CommentAuthorCount[] = [...commentsByAuthor.entries()]
    .map(([authorId, count]) => ({ author_id: authorId, comments: count }))
    .sort((a, b) => b.comments - a.comments || a.author_id.localeCompare(b.author_id));

  // Recency ties are broken by the unique comment id so the newest comment is
  // identical on every backend.
  let newest: Comment | undefined;
  for (const comment of scoped) {
    if (
      !newest ||
      comment.created_at > newest.created_at ||
      (comment.created_at === newest.created_at && comment.id > newest.id)
    ) {
      newest = comment;
    }
  }

  return {
    total_comments: scoped.length,
    total_authors: commentsByAuthor.size,
    total_projects: commentsByProject.size,
    by_reference: byReference,
    by_project: byProject,
    by_author: byAuthor,
    newest_comment_at: newest?.created_at ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/comments/stats` request. */
export function commentStatsQueryParams(
  options: CommentStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
