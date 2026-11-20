/**
 * Authoritative single-orchestration-run overview contracts.
 * Mirrors backend/app/schemas/run_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { JobStatusCount } from "./jobStats";
import type { JobStatus } from "./operation";
import type { OrchestrationStage } from "./orchestration";

/** Whole-scope totals for one orchestration run, derived authoritatively. */
export interface RunOverviewCounts {
  jobs_linked: number;
  jobs_resolved: number;
  plan_steps: number;
}

/** A job linked from a run, resolved from the authoritative job store. */
export interface RunOverviewJobRef {
  job_id: Uuid;
  operation_id: string;
  status: JobStatus;
  progress?: number;
  created_at: Timestamp;
}

/** A single-run snapshot: identity, joined context, counts and recent jobs. */
export interface RunOverview {
  run_id: Uuid;
  plan_id: Uuid;
  project_id?: Uuid | null;
  project_name: string;
  plan_goal?: string | null;
  stage: OrchestrationStage;
  created_at: Timestamp;
  counts: RunOverviewCounts;
  by_status?: JobStatusCount[];
  recent_jobs?: RunOverviewJobRef[];
  generated_at: Timestamp;
}
