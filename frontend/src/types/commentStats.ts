/**
 * Authoritative comment statistics contracts.
 * Mirrors backend/app/schemas/comment_stats.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";

/** Whether a comment references an asset or is project-level only. */
export type CommentReference = "asset" | "project";

/** Number of comments in one canonical reference category. */
export interface CommentReferenceCount {
  reference: CommentReference;
  count: number;
}

/** Comment and distinct-author activity recorded for one project. */
export interface CommentProjectCount {
  project_id: Uuid;
  comments: number;
  authors: number;
}

/** Number of comments authored by one user. */
export interface CommentAuthorCount {
  author_id: Uuid;
  comments: number;
}

/** Comment metrics derived from the authoritative comment store. */
export interface CommentStats {
  total_comments: number;
  total_authors: number;
  total_projects: number;
  by_reference?: CommentReferenceCount[];
  by_project?: CommentProjectCount[];
  by_author?: CommentAuthorCount[];
  newest_comment_at?: Timestamp | null;
  generated_at: Timestamp;
}
