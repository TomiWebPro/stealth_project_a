/**
 * Authoritative production-pipeline statistics derivation + query helpers (C73 follow-up).
 *
 * The backend (`PipelineStatsRepository`) derives the whole snapshot from the
 * three authoritative chain collections on every call — training/LoRA, shot and
 * splat — with no second index. `lib/pipelineStats` reproduces that derivation
 * exactly so mock mode stays at feature parity with live mode and the parity
 * guard can drive both transports over the same chain seeds.
 */

import { ApiError } from "../api/client";
import type {
  PipelineKind,
  PipelineKindStats,
  PipelineProjectCount,
  PipelineStats,
} from "./types";

/** Optional scope mirrored from the authoritative `/pipelines/stats` endpoint. */
export interface PipelineStatsOptions {
  readonly projectId?: string;
}

/**
 * Minimal shape shared by the three authoritative chain documents. The backend
 * counts jobs from `job_ids` (training/splat) or a single `job_id` (shot), and
 * assets from every declared field whose name ends in `_asset_id`. The index
 * signature lets the mock seeds carry those concrete asset fields while the
 * derivation reproduces the backend's reflective count exactly.
 */
export interface PipelineChainRecord {
  readonly id: string;
  readonly project_id: string;
  readonly created_at: string;
  readonly created_by?: string;
  readonly job_ids?: readonly string[] | null;
  readonly job_id?: string | null;
  readonly [key: string]: unknown;
}

/** Canonical chain kinds, matching `get_args(PipelineKind)` on the backend. */
export const PIPELINE_KINDS: readonly PipelineKind[] = ["training", "shot", "splat"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live
 * fail identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validatePipelineStatsArgs(options: PipelineStatsOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
}

/** Jobs spawned by a chain: a `job_ids` list or a single `job_id`. */
export function jobCount(chain: PipelineChainRecord): number {
  if (chain.job_ids != null) return chain.job_ids.length;
  return chain.job_id != null ? 1 : 0;
}

/** Asset references produced by a chain: every non-null `*_asset_id` field. */
export function assetCount(chain: PipelineChainRecord): number {
  return Object.keys(chain).filter(
    (field) => field.endsWith("_asset_id") && chain[field] != null,
  ).length;
}

/** Python-compatible `(created_at, str(id))` tuple comparison for recency. */
function compareNewest(a: PipelineChainRecord, b: PipelineChainRecord): number {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? 1 : -1;
  if (a.id !== b.id) return a.id > b.id ? 1 : -1;
  return 0;
}

/**
 * Derive pipeline execution metrics exactly as the backend repository does:
 * zero-filled per-kind chain/job/asset buckets, per-project chain counts sorted
 * by descending count then project id, global totals and newest-chain recency.
 * An empty scope yields zero counts, zero-filled kind buckets, an empty project
 * breakdown and a `null` recency (never an error).
 */
export function derivePipelineStats(
  chains: readonly PipelineChainRecord[],
  now: string,
  options: PipelineStatsOptions = {},
): PipelineStats {
  const scoped = options.projectId
    ? chains.filter((chain) => chain.project_id === options.projectId)
    : chains;

  const kindChains: Record<string, number> = {};
  const kindJobs: Record<string, number> = {};
  const kindAssets: Record<string, number> = {};
  for (const kind of PIPELINE_KINDS) {
    kindChains[kind] = 0;
    kindJobs[kind] = 0;
    kindAssets[kind] = 0;
  }

  const projectChains = new Map<string, number>();
  let totalChains = 0;
  let totalJobs = 0;
  let totalAssets = 0;
  let newest: PipelineChainRecord | undefined;

  for (const chain of scoped) {
    // Match the backend's `kind` sources: every chain seed carries the kind on
    // its record so the same job/asset counters can be bucketed deterministically.
    const kind = String(chain.kind);
    const jobs = jobCount(chain);
    const assets = assetCount(chain);
    kindChains[kind] = (kindChains[kind] ?? 0) + 1;
    kindJobs[kind] = (kindJobs[kind] ?? 0) + jobs;
    kindAssets[kind] = (kindAssets[kind] ?? 0) + assets;
    projectChains.set(chain.project_id, (projectChains.get(chain.project_id) ?? 0) + 1);
    totalChains += 1;
    totalJobs += jobs;
    totalAssets += assets;
    if (!newest || compareNewest(chain, newest) > 0) newest = chain;
  }

  const byKind: PipelineKindStats[] = PIPELINE_KINDS.map((kind) => ({
    kind,
    chains: kindChains[kind] ?? 0,
    jobs: kindJobs[kind] ?? 0,
    assets: kindAssets[kind] ?? 0,
  }));
  const byProject: PipelineProjectCount[] = [...projectChains.entries()]
    .map(([project_id, chains]) => ({ project_id, chains }))
    .sort((a, b) => b.chains - a.chains || a.project_id.localeCompare(b.project_id));

  return {
    total_chains: totalChains,
    total_jobs: totalJobs,
    total_assets: totalAssets,
    by_kind: byKind,
    by_project: byProject,
    newest_chain_at: newest?.created_at ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/pipelines/stats` request. */
export function pipelineStatsQueryParams(
  options: PipelineStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
