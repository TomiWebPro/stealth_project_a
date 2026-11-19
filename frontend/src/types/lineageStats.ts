/**
 * Authoritative asset lineage statistics contracts.
 * Mirrors backend/app/schemas/lineage_stats.py — do not change one side without the other.
 */

import type { RelationshipType } from "./asset";
import type { Timestamp, Uuid } from "./common";

/** Number of relationships of one canonical type. */
export interface LineageTypeCount {
  type: RelationshipType;
  count: number;
}

/** Number of relationships originating from assets in one project. */
export interface LineageProjectCount {
  project_id: Uuid;
  relationships: number;
}

/** Lineage metrics derived from the authoritative relationship store. */
export interface LineageStats {
  total_relationships: number;
  total_linked_assets: number;
  by_type?: LineageTypeCount[];
  by_project?: LineageProjectCount[];
  newest_relationship_at?: Timestamp | null;
  generated_at: Timestamp;
}
