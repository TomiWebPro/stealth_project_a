/**
 * Authoritative comment-feed contracts.
 * Mirrors backend/app/schemas/comment_feed.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";

/** One project comment projected from the authoritative comment store. */
export interface CommentFeedItem {
  comment_id: Uuid;
  project_id: Uuid;
  project_name: string;
  asset_id?: Uuid | null;
  author_id: Uuid;
  body: string;
  created_at: Timestamp;
}

/** A bounded, newest-first page of comments with a whole-scope total. */
export interface CommentFeed {
  items?: CommentFeedItem[];
  total: number;
  generated_at: Timestamp;
}
