/**
 * Authoritative downstream asset impact contracts.
 * Mirrors backend/app/schemas/impact.py — do not change one side without the other.
 */

import type { Uuid } from "./common";
import type { RelationshipType } from "./asset";

/** A descendant asset, its direct relationship to its parent and its depth. */
export interface ImpactNode {
  asset_id: Uuid;
  relationship?: RelationshipType | null;
  depth?: number;
}

/** Downstream impact derived from the authoritative relationship store. */
export interface AssetImpact {
  root_asset_id: Uuid;
  descendants?: ImpactNode[];
  total: number;
}
