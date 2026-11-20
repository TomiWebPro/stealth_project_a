/**
 * Authoritative single asset-version overview contracts.
 * Mirrors backend/app/schemas/version_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { AssetType, AssetVersion, StorageRef } from "./asset";

/** Whole-asset version activity for the version's parent asset, never bounded. */
export interface VersionOverviewCounts {
  asset_versions: number;
  revisions: number;
}

/** A single-version snapshot: identity, storage, context and version activity. */
export interface VersionOverview {
  asset_id: Uuid;
  asset_name: string;
  asset_type: AssetType;
  project_id: Uuid;
  project_name: string;
  version: number;
  storage: StorageRef;
  created_by: Uuid;
  created_at: Timestamp;
  is_latest: boolean;
  counts: VersionOverviewCounts;
  recent_versions?: AssetVersion[];
  generated_at: Timestamp;
}
