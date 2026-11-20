/**
 * Authoritative single-pipeline-chain overview contracts.
 * Mirrors backend/app/schemas/chain_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { AssetType } from "./asset";
import type { JobStatus } from "./operation";
import type { PipelineKind } from "./pipelineStats";

/** Whole-scope totals for one chain, derived authoritatively. */
export interface ChainOverviewCounts {
  jobs: number;
  assets: number;
}

/** A job linked from a chain, resolved from the authoritative job store. */
export interface ChainJobRef {
  job_id: Uuid;
  operation_id: string;
  status: JobStatus;
  created_at: Timestamp;
}

/** An asset produced by a chain, resolved from the authoritative asset store. */
export interface ChainAssetRef {
  asset_id: Uuid;
  name: string;
  asset_type: AssetType;
  created_at: Timestamp;
}

/** A single-chain snapshot: identity, counts and recent linked items. */
export interface ChainOverview {
  chain_id: Uuid;
  project_id: Uuid;
  project_name: string;
  kind: PipelineKind;
  created_by: Uuid;
  created_at: Timestamp;
  counts: ChainOverviewCounts;
  recent_jobs?: ChainJobRef[];
  recent_assets?: ChainAssetRef[];
  generated_at: Timestamp;
}
