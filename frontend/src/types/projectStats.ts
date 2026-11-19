/**
 * Authoritative project portfolio statistics contracts.
 * Mirrors backend/app/schemas/project_stats.py — do not change one side without the other.
 */

import type { Timestamp } from "./common";

export type ProjectLifecycle = "active" | "archived";

/** Number of projects in one lifecycle state. */
export interface ProjectLifecycleCount {
  lifecycle: ProjectLifecycle;
  count: number;
}

/** Project portfolio metrics derived from the authoritative stores. */
export interface ProjectStats {
  total: number;
  by_lifecycle?: ProjectLifecycleCount[];
  active: number;
  archived: number;
  total_assets: number;
  total_conversations: number;
  total_jobs: number;
  average_assets_per_project?: number;
  average_jobs_per_project?: number;
  newest_project_at?: Timestamp | null;
  generated_at: Timestamp;
}
