/**
 * Authoritative single-comment overview contracts.
 * Mirrors backend/app/schemas/comment_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { CommentFeedItem } from "./commentFeed";
import type { CommentReference } from "./commentStats";

/** Whole-project and same-thread comment activity, never bounded by the page. */
export interface CommentOverviewCounts {
  project_comments: number;
  project_authors: number;
  project_assets: number;
  thread_comments: number;
}

/** A single-comment snapshot: identity, context, activity and thread siblings. */
export interface CommentOverview {
  comment_id: Uuid;
  project_id: Uuid;
  project_name: string;
  asset_id?: Uuid | null;
  author_id: Uuid;
  body: string;
  created_at: Timestamp;
  reference: CommentReference;
  counts: CommentOverviewCounts;
  recent_comments?: CommentFeedItem[];
  generated_at: Timestamp;
}
