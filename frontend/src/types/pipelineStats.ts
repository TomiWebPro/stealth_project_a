/**
 * Authoritative production-pipeline statistics contracts.
 * Mirrors backend/app/schemas/pipeline_stats.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";

/** The three authoritative production-pipeline kinds. */
export type PipelineKind = "training" | "shot" | "splat";

/** Chain/job/asset totals for one production-pipeline kind. */
export interface PipelineKindStats {
  kind: PipelineKind;
  chains: number;
  jobs: number;
  assets: number;
}

/** Number of pipeline chains produced for one project. */
export interface PipelineProjectCount {
  project_id: Uuid;
  chains: number;
}

/** Pipeline execution metrics derived from the authoritative chain stores. */
export interface PipelineStats {
  total_chains: number;
  total_jobs: number;
  total_assets: number;
  by_kind?: PipelineKindStats[];
  by_project?: PipelineProjectCount[];
  newest_chain_at?: Timestamp | null;
  generated_at: Timestamp;
}
