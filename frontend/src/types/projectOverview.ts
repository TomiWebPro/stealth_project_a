/**
 * Authoritative single-project overview contracts.
 * Mirrors backend/app/schemas/project_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { Asset } from "./asset";
import type { Job } from "./operation";
import type { ProjectLifecycle } from "./projectStats";

/** Cross-domain totals for one project, derived from the authoritative stores. */
export interface ProjectOverviewCounts {
  assets: number;
  conversations: number;
  jobs: number;
  comments: number;
  publishes: number;
  versions: number;
  collaborators: number;
}

/** A single-project snapshot: identity, counts and a few recent items. */
export interface ProjectOverview {
  project_id: Uuid;
  project_name: string;
  lifecycle: ProjectLifecycle;
  created_at: Timestamp;
  counts: ProjectOverviewCounts;
  recent_jobs?: Job[];
  recent_assets?: Asset[];
  generated_at: Timestamp;
}
