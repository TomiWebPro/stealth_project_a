/**
 * Authoritative publish-feed contracts.
 * Mirrors backend/app/schemas/publish_feed.py — do not change one side without the other.
 */

import type { AssetType } from "./asset";
import type { Timestamp, Uuid } from "./common";

/** One published deliverable projected from an asset's publish receipt. */
export interface PublishFeedItem {
  asset_id: Uuid;
  asset_name: string;
  asset_type: AssetType;
  project_id: Uuid;
  project_name: string;
  version: number;
  size_bytes: number;
  published_at: Timestamp;
}

/** A bounded, newest-first page of published assets with a whole-scope total. */
export interface PublishFeed {
  items?: PublishFeedItem[];
  total: number;
  generated_at: Timestamp;
}
