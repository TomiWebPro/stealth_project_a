/**
 * Authoritative single publish-receipt overview contracts.
 * Mirrors backend/app/schemas/publish_overview.py — do not change one side without the other.
 */

import type { AssetType } from "./asset";
import type { Timestamp, Uuid } from "./common";
import type { PublishFeedItem } from "./publishFeed";

/** Publish activity totals derived from the authoritative asset store. */
export interface PublishOverviewCounts {
  project_published: number;
  project_bytes: number;
  total_published: number;
}

/** A single-publication snapshot: identity, context, counts and siblings. */
export interface PublishOverview {
  asset_id: Uuid;
  asset_name: string;
  asset_type: AssetType;
  project_id: Uuid;
  project_name: string;
  version: number;
  size_bytes: number;
  published_at: Timestamp;
  counts: PublishOverviewCounts;
  recent_siblings?: PublishFeedItem[];
  generated_at: Timestamp;
}
