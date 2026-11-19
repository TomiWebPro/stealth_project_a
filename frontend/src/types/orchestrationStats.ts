/**
 * Authoritative orchestration statistics contracts.
 * Mirrors backend/app/schemas/orchestration_stats.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { OrchestrationStage } from "./orchestration";

/** Number of orchestration runs in one canonical lifecycle stage. */
export interface OrchestrationStageCount {
  stage: OrchestrationStage;
  count: number;
}

/** Plans and runs recorded for one project. */
export interface OrchestrationProjectCount {
  project_id: Uuid;
  plans: number;
  runs: number;
}

/** Orchestration metrics derived from the authoritative plan/run stores. */
export interface OrchestrationStats {
  total_plans: number;
  total_runs: number;
  total_steps: number;
  total_jobs_linked: number;
  by_stage?: OrchestrationStageCount[];
  by_project?: OrchestrationProjectCount[];
  newest_plan_at?: Timestamp | null;
  newest_run_at?: Timestamp | null;
  generated_at: Timestamp;
}
