/**
 * Authoritative single lineage-relationship overview contracts.
 * Mirrors backend/app/schemas/lineage_overview.py — do not change one side without the other.
 */

import type { AssetType, RelationshipType } from "./asset";
import type { LineageFeedItem } from "./lineageFeed";
import type { Timestamp, Uuid } from "./common";

/** Whole-source-asset lineage activity, never bounded by the page. */
export interface LineageOverviewCounts {
  source_upstream: number;
  source_downstream: number;
  source_types: number;
  project_relationships: number;
}

/** A single relationship snapshot: endpoints, context, activity and siblings. */
export interface LineageOverview {
  id: Uuid;
  from_asset_id: Uuid;
  to_asset_id: Uuid;
  from_asset_name: string;
  to_asset_name: string;
  from_asset_type: AssetType;
  to_asset_type?: AssetType | null;
  project_id: Uuid;
  project_name: string;
  type: RelationshipType;
  created_at: Timestamp;
  counts: LineageOverviewCounts;
  recent_relationships?: LineageFeedItem[];
  generated_at: Timestamp;
}
