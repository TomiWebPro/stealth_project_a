/**
 * Authoritative asset version-feed contracts.
 * Mirrors backend/app/schemas/version_feed.py — do not change one side without the other.
 */

import type { AssetType } from "./asset";
import type { Timestamp, Uuid } from "./common";

/** One asset version projected from the authoritative version store. */
export interface VersionFeedItem {
  asset_id: Uuid;
  project_id: Uuid;
  project_name: string;
  asset_name: string;
  asset_type: AssetType;
  version: number;
  created_by: Uuid;
  created_at: Timestamp;
}

/** A bounded, newest-first page of asset versions with a whole-scope total. */
export interface VersionFeed {
  items?: VersionFeedItem[];
  total: number;
  generated_at: Timestamp;
}
