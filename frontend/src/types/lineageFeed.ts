/**
 * Authoritative asset lineage-feed contracts.
 * Mirrors backend/app/schemas/lineage_feed.py — do not change one side without the other.
 */

import type { RelationshipType } from "./asset";
import type { Timestamp, Uuid } from "./common";

/** One typed asset relationship projected from the authoritative store. */
export interface LineageFeedItem {
  id: Uuid;
  from_asset_id: Uuid;
  to_asset_id: Uuid;
  from_asset_name: string;
  to_asset_name: string;
  project_id: Uuid;
  project_name: string;
  type: RelationshipType;
  created_at: Timestamp;
}

/** A bounded, newest-first page of relationships with a whole-scope total. */
export interface LineageFeed {
  items?: LineageFeedItem[];
  total: number;
  generated_at: Timestamp;
}
