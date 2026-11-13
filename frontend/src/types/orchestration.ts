/**
 * Orchestration, collaboration and storage helper contracts.
 * Mirrors backend/app/schemas/orchestration.py.
 */

import type { Metadata, Timestamp, Uuid } from "./common";

export type OrchestrationStage =
  | "plan"
  | "resolve"
  | "submit"
  | "await"
  | "collect"
  | "done";
export type PresenceState = "online" | "away" | "offline";
export type StorageQuotaUnit = "bytes" | "objects";

export interface OrchestrationPlanStep {
  step_id: string;
  operation_id: string;
  depends_on?: string[];
  settings?: Metadata;
}

/** Execution plan produced by the orchestration layer (not source of truth). */
export interface OrchestrationPlan {
  plan_id: Uuid;
  project_id: Uuid;
  goal?: string | null;
  steps?: OrchestrationPlanStep[];
  created_at: Timestamp;
}

export interface OrchestrationRunRequest {
  project_id: Uuid;
  conversation_id?: Uuid | null;
  goal: string;
}

export interface OrchestrationRun {
  run_id: Uuid;
  plan_id: Uuid;
  stage: OrchestrationStage;
  job_ids?: Uuid[];
  created_at: Timestamp;
}

export interface Presence {
  user_id: Uuid;
  project_id: Uuid;
  state: PresenceState;
  last_seen_at: Timestamp;
}

export interface Comment {
  id: Uuid;
  project_id: Uuid;
  asset_id?: Uuid | null;
  author_id: Uuid;
  body: string;
  created_at: Timestamp;
}

export interface StorageQuota {
  used: number;
  limit: number;
  unit?: StorageQuotaUnit;
}

export interface StorageStats {
  project_id: Uuid;
  quota: StorageQuota;
  object_count?: number;
}
