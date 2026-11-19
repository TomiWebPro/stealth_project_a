/**
 * Authoritative asset inventory statistics contracts.
 * Mirrors backend/app/schemas/asset_stats.py — do not change one side without the other.
 */

import type { AssetStatus, AssetType } from "./asset";
import type { Timestamp } from "./common";

/** Number of live assets of one type. */
export interface AssetTypeCount {
  type: AssetType;
  count: number;
}

/** Number of live assets in one lifecycle status. */
export interface AssetStatusCount {
  status: AssetStatus;
  count: number;
}

/** Inventory metrics derived from the authoritative asset store. */
export interface AssetStats {
  total: number;
  by_type?: AssetTypeCount[];
  by_status?: AssetStatusCount[];
  total_size_bytes: number;
  total_versions: number;
  newest_asset_at?: Timestamp | null;
  generated_at: Timestamp;
}
