/**
 * Authoritative asset version statistics contracts.
 * Mirrors backend/app/schemas/version_stats.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";

/** Number of version records that share a version number. */
export interface VersionNumberCount {
  version: number;
  count: number;
}

/** Version activity recorded for one project. */
export interface VersionProjectCount {
  project_id: Uuid;
  versions: number;
  assets: number;
}

/** Version metrics derived from the authoritative asset version store. */
export interface VersionStats {
  total_versions: number;
  total_assets: number;
  revisions: number;
  by_version?: VersionNumberCount[];
  by_project?: VersionProjectCount[];
  newest_version_at?: Timestamp | null;
  generated_at: Timestamp;
}
