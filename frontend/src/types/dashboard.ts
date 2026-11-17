/**
 * Authoritative dashboard summary contracts.
 * Mirrors backend/app/schemas/dashboard.ts — do not change one side without the other.
 */

import type { Timestamp } from "./common";
import type { Asset } from "./asset";
import type { Job } from "./operation";

/** Entity totals derived from the authoritative stores on every call. */
export interface DashboardCounts {
  projects: number;
  assets: number;
  conversations: number;
  jobs: number;
  providers: number;
  enabled_extensions: number;
}

/** A home-screen snapshot: counts, breakdowns and a few recent items. */
export interface DashboardSummary {
  counts: DashboardCounts;
  generated_at: Timestamp;
  jobs_by_status?: Record<string, number>;
  assets_by_type?: Record<string, number>;
  recent_jobs?: Job[];
  recent_assets?: Asset[];
}
