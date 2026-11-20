/**
 * Authoritative single-orchestration-plan overview contracts.
 * Mirrors backend/app/schemas/plan_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { OrchestrationStage } from "./orchestration";
import type { OrchestrationStageCount } from "./orchestrationStats";

/** Whole-scope totals for one orchestration plan, derived authoritatively. */
export interface PlanOverviewCounts {
  steps: number;
  runs: number;
  jobs_linked: number;
}

/** A run executing a plan, projected from the authoritative run store. */
export interface PlanOverviewRunRef {
  run_id: Uuid;
  stage: OrchestrationStage;
  job_count: number;
  created_at: Timestamp;
}

/** A single-plan snapshot: identity, counts, stage coverage and recent runs. */
export interface PlanOverview {
  plan_id: Uuid;
  project_id: Uuid;
  project_name: string;
  goal?: string | null;
  created_at: Timestamp;
  counts: PlanOverviewCounts;
  by_stage?: OrchestrationStageCount[];
  recent_runs?: PlanOverviewRunRef[];
  generated_at: Timestamp;
}
