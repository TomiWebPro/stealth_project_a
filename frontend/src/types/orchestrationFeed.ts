/**
 * Authoritative orchestration-feed contracts.
 * Mirrors backend/app/schemas/orchestration_feed.ts — do not change one side without the other.
 */

import type { OrchestrationStage } from "./orchestration";
import type { Timestamp, Uuid } from "./common";

/** The two authoritative orchestration record kinds surfaced by the feed. */
export type OrchestrationFeedKind = "plan" | "run";

/** One plan or run projected from the authoritative orchestration stores. */
export interface OrchestrationFeedItem {
  id: Uuid;
  kind: OrchestrationFeedKind;
  plan_id: Uuid;
  run_id?: Uuid | null;
  project_id: Uuid;
  project_name: string;
  goal?: string | null;
  stage?: OrchestrationStage | null;
  step_count: number;
  job_count: number;
  created_at: Timestamp;
}

/** A bounded, newest-first page of orchestration activity with a total. */
export interface OrchestrationFeed {
  items?: OrchestrationFeedItem[];
  total: number;
  generated_at: Timestamp;
}
