/**
 * Authoritative single-comment overview derivation + query helpers (C254
 * follow-up).
 *
 * The backend (`CommentOverviewRepository`) derives the whole snapshot fresh from
 * the authoritative `COMMENTS` collection — the same store `GET|POST /comments`
 * reads/writes, `/comments/feed` projects and `/comments/stats` aggregates — with
 * the project display name joined from the authoritative project store. There is
 * no second index. `counts` reuses the exact per-project semantics of
 * `/comments/stats` (comment + distinct-author totals, distinct referenced
 * assets) plus a same-thread total, so the single view can never disagree with
 * that snapshot. `recent_comments` reuses the canonical `CommentFeedItem`
 * projection from `/comments/feed`, so the wire shape is byte-for-byte identical
 * across both storage adapters.
 *
 * An unknown comment is a 404 checked by the fetch layer and normalized to
 * `undefined` by the transports; a malformed id or invalid `recent_limit` uses
 * the shared 422 envelope. `lib/commentOverview` reproduces that derivation over
 * the same comment/project seeds so mock mode stays at feature parity with live
 * mode and the parity guard can drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import { deriveCommentFeed, UNKNOWN_COMMENT_PROJECT_NAME } from "./commentFeed";
import type { Comment, CommentOverview, Project } from "./types";

/** Optional page bound mirrored from the authoritative `/comments/{id}/overview` endpoint. */
export interface CommentOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface CommentOverviewSeeds {
  readonly comments: readonly Comment[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_COMMENT_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`comment_id` UUID and `recent_limit` ge=1,
 * le=50) so mock and live fail identically with the shared normalized error
 * envelope. An unknown-but-valid comment is a 404 checked by the fetch layer.
 */
export function validateCommentOverviewArgs(
  commentId: string,
  options: CommentOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(commentId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid comment id.",
      details: [{ field: "comment_id", message: "comment_id must be a valid UUID" }],
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
      message: "Comment overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-comment snapshot exactly as the backend repository does.
 * `commentId` is assumed to exist (the fetch layer rejects unknown comments);
 * an unseeded comment throws the shared 404 envelope. The project name is joined
 * when present, with a stable fallback for an orphan comment. Whole-project
 * counts reuse `/comments/stats` per-project semantics, the thread is the set of
 * comments sharing the project and asset scope, and the newest-first sibling
 * page reuses the canonical `/comments/feed` projection (counts are never
 * bounded by that page).
 */
export function deriveCommentOverview(
  commentId: string,
  seeds: CommentOverviewSeeds,
  options: CommentOverviewOptions = {},
): CommentOverview {
  const target = seeds.comments.find((candidate) => candidate.id === commentId);
  if (!target) {
    throw new ApiError({
      status: 404,
      code: "comment_not_found",
      message: `Comment '${commentId}' was not found.`,
    });
  }

  const { recentLimit = DEFAULT_COMMENT_OVERVIEW_RECENT_LIMIT } = options;
  const project = seeds.projects.find((candidate) => candidate.id === target.project_id);
  const projectName = project?.name ?? UNKNOWN_COMMENT_PROJECT_NAME;

  const projectComments = seeds.comments.filter(
    (comment) => comment.project_id === target.project_id,
  );
  const authors = new Set(projectComments.map((comment) => comment.author_id));
  const assets = new Set(
    projectComments
      .map((comment) => comment.asset_id)
      .filter((assetId): assetId is NonNullable<typeof assetId> => assetId != null),
  );

  // A thread is all comments on the same project with the same asset scope
  // (project-level comments form the asset_id = null thread).
  const targetAssetId = target.asset_id ?? null;
  const thread = projectComments.filter(
    (comment) => (comment.asset_id ?? null) === targetAssetId,
  );

  const counts: CommentOverview["counts"] = {
    project_comments: projectComments.length,
    project_authors: authors.size,
    project_assets: assets.size,
    thread_comments: thread.length,
  };

  // The canonical comment-feed projection already sorts newest-first with a
  // deterministic comment-id tie-break, joins project names and emits the exact
  // CommentFeedItem wire shape the backend reuses for the sibling page.
  const recentComments = deriveCommentFeed(thread, seeds.projects, seeds.now, {
    projectId: target.project_id,
    limit: recentLimit,
  }).items;

  return {
    comment_id: target.id,
    project_id: target.project_id,
    project_name: projectName,
    asset_id: target.asset_id ?? null,
    author_id: target.author_id,
    body: target.body,
    created_at: target.created_at,
    reference: target.asset_id != null ? "asset" : "project",
    counts,
    recent_comments: recentComments,
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/comments/{id}/overview` request. */
export function commentOverviewQueryParams(
  options: CommentOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
