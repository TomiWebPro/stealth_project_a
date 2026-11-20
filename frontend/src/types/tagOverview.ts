/**
 * Authoritative single-tag overview contracts.
 * Mirrors backend/app/schemas/tag_overview.py — do not change one side without the other.
 */

import type { AssetFeedItem } from "./assetFeed";
import type { Timestamp, Uuid } from "./common";

/** Tag usage totals derived from the authoritative asset store. */
export interface TagOverviewCounts {
  tagged_assets: number;
  tagged_projects: number;
  scope_assets: number;
}

/** A single-tag snapshot: identity, scope, counts and recent tagged assets. */
export interface TagOverview {
  tag: string;
  project_id?: Uuid | null;
  project_name?: string | null;
  counts: TagOverviewCounts;
  recent_assets?: AssetFeedItem[];
  generated_at: Timestamp;
}
