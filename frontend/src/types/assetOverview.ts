/**
 * Authoritative single-asset overview contracts.
 * Mirrors backend/app/schemas/asset_overview.ts — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { AssetStatus, AssetType, AssetVersion } from "./asset";

/** Cross-domain totals for one asset, derived from the authoritative stores. */
export interface AssetOverviewCounts {
  versions: number;
  upstream: number;
  downstream: number;
  comments: number;
  tags: number;
}

/** A single-asset snapshot: identity, counts and a few recent versions. */
export interface AssetOverview {
  asset_id: Uuid;
  asset_name: string;
  asset_type: AssetType;
  status: AssetStatus;
  version: number;
  project_id: Uuid;
  project_name: string;
  created_at: Timestamp;
  published: boolean;
  counts: AssetOverviewCounts;
  recent_versions?: AssetVersion[];
  generated_at: Timestamp;
}
