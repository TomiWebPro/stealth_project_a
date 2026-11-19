/**
 * Authoritative production-pipeline feed contracts.
 * Mirrors backend/app/schemas/pipeline_feed.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { PipelineKind } from "./pipelineStats";

/** One pipeline chain projected from the authoritative chain stores. */
export interface PipelineFeedItem {
  chain_id: Uuid;
  project_id: Uuid;
  project_name: string;
  kind: PipelineKind;
  job_count: number;
  asset_count: number;
  created_by: Uuid;
  created_at: Timestamp;
}

/** A bounded, newest-first page of pipeline chains with a whole-scope total. */
export interface PipelineFeed {
  items?: PipelineFeedItem[];
  total: number;
  generated_at: Timestamp;
}
