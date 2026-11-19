/**
 * Authoritative asset feed contracts.
 * Mirrors backend/app/schemas/asset_feed.py — do not change one side without the other.
 */

import type { AssetStatus, AssetType } from "./asset";
import type { Timestamp, Uuid } from "./common";

/** One live asset projected from the authoritative asset store. */
export interface AssetFeedItem {
  asset_id: Uuid;
  project_id: Uuid;
  project_name: string;
  type: AssetType;
  name: string;
  status: AssetStatus;
  version: number;
  size_bytes: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** A bounded, newest-first page of assets with a whole-scope total. */
export interface AssetFeed {
  items?: AssetFeedItem[];
  total: number;
  generated_at: Timestamp;
}
