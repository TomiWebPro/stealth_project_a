/**
 * Authoritative single-pipeline-chain overview derivation + query helpers (C234
 * follow-up).
 *
 * The backend (`ChainOverviewRepository`) derives the whole snapshot fresh from
 * the three authoritative chain collections — the same stores `/pipelines`
 * lists and `/pipelines/stats` aggregates — with the linked jobs/assets resolved
 * from the authoritative job/asset stores on every call. There is no second
 * index. `counts` reuse the exact `jobCount`/`assetCount` derivation the
 * pipeline stats/feed views use, so the overview can never disagree with them,
 * while `recent_jobs`/`recent_assets` are bounded newest-first projections of
 * the linked ids (orphan jobs and soft-deleted/missing assets are skipped).
 *
 * `lib/chainOverview` reproduces that derivation over the same chain/job/asset/
 * project seeds so mock mode stays at feature parity with live mode and the
 * parity guard can drive both transports over identical data. An unknown chain
 * is a 404 checked by the fetch layer and normalized to `undefined` by the
 * transports; a malformed id or an out-of-range `recent_limit` uses the shared
 * 422 envelope.
 */

import { ApiError } from "../api/client";
import type { Asset, ChainAssetRef, ChainJobRef, ChainOverview, Job, Project } from "./types";
import { assetCount as chainAssetCount, jobCount as chainJobCount } from "./pipelineStats";
import type { PipelineChainRecord } from "./pipelineStats";

/** Optional page bound mirrored from the authoritative `/pipelines/{id}/overview` endpoint. */
export interface ChainOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface ChainOverviewSeeds {
  readonly chains: readonly PipelineChainRecord[];
  readonly jobs: readonly Job[];
  readonly assets: readonly Asset[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

/** Stable display name used by the backend when a chain's project is missing. */
export const UNKNOWN_CHAIN_OVERVIEW_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_CHAIN_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/** Python-compatible lexicographic comparison (matches `sorted()` on str). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Descending `(created_at, str(id))` comparison, matching the backend's `reverse=True`. */
function compareNewest(
  a: { created_at: string; id: string },
  b: { created_at: string; id: string },
): number {
  const byTime = compareStrings(b.created_at, a.created_at);
  return byTime !== 0 ? byTime : compareStrings(b.id, a.id);
}

/**
 * Mirror the router's validation (`chain_id` UUID and `recent_limit` ge=1,
 * le=50) so mock and live fail identically with the shared normalized error
 * envelope. An unknown-but-valid chain is a 404 checked by the fetch layer.
 */
export function validateChainOverviewArgs(
  chainId: string,
  options: ChainOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(chainId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid chain id.",
      details: [{ field: "chain_id", message: "chain_id must be a valid UUID" }],
    });
  }
  const { recentLimit } = options;
  if (
    recentLimit !== undefined &&
    (!Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > MAX_RECENT_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Chain overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Linked job ids: a `job_ids` list or a single `job_id`. Matches the backend's
 * `_linked_job_ids`, which does not deduplicate the list (the store tracks the
 * actual links).
 */
function linkedJobIds(chain: PipelineChainRecord): string[] {
  if (chain.job_ids != null) return [...chain.job_ids];
  return chain.job_id != null ? [chain.job_id] : [];
}

/**
 * Linked asset ids: every non-null `*_asset_id` field, de-duplicated in stable
 * declaration order. Matches the backend's `_linked_asset_ids` reflection over
 * the chain model fields.
 */
function linkedAssetIds(chain: PipelineChainRecord): string[] {
  const ids: string[] = [];
  for (const field of Object.keys(chain)) {
    if (!field.endsWith("_asset_id")) continue;
    const value = chain[field];
    if (typeof value === "string" && !ids.includes(value)) ids.push(value);
  }
  return ids;
}

/**
 * Derive a single-chain snapshot exactly as the backend repository does.
 * `chainId` is assumed to exist (the fetch layer rejects unknown chains); an
 * unseeded chain throws the shared 404 envelope. Counts describe the whole
 * chain and are never bounded by `recent_limit`, while the recent lists are
 * newest-first and bounded. Orphan jobs and soft-deleted/missing assets are
 * skipped, and a missing project falls back to a stable display name.
 */
export function deriveChainOverview(
  chainId: string,
  seeds: ChainOverviewSeeds,
  options: ChainOverviewOptions = {},
): ChainOverview {
  const chain = seeds.chains.find((candidate) => candidate.id === chainId);
  if (!chain) {
    throw new ApiError({
      status: 404,
      code: "chain_not_found",
      message: `Pipeline chain '${chainId}' was not found.`,
    });
  }

  const { recentLimit = DEFAULT_CHAIN_OVERVIEW_RECENT_LIMIT } = options;
  const project = seeds.projects.find((candidate) => candidate.id === chain.project_id);
  const projectName = project?.name ?? UNKNOWN_CHAIN_OVERVIEW_PROJECT_NAME;

  const jobIds = linkedJobIds(chain);
  const jobs: ChainJobRef[] = jobIds
    .map((jobId) => seeds.jobs.find((candidate) => candidate.id === jobId))
    .filter((job): job is Job => job !== undefined)
    .sort(compareNewest)
    .slice(0, recentLimit)
    .map((job) => ({
      job_id: job.id,
      operation_id: job.operation_id,
      status: job.status,
      created_at: job.created_at,
    }));

  const assetIds = linkedAssetIds(chain);
  const assets: ChainAssetRef[] = assetIds
    .map((assetId) => seeds.assets.find((candidate) => candidate.id === assetId))
    .filter((asset): asset is Asset => asset !== undefined && asset.status !== "deleted")
    .sort(compareNewest)
    .slice(0, recentLimit)
    .map((asset) => ({
      asset_id: asset.id,
      name: asset.name,
      asset_type: asset.type,
      created_at: asset.created_at,
    }));

  return {
    chain_id: chainId,
    project_id: chain.project_id,
    project_name: projectName,
    kind: String(chain.kind) as ChainOverview["kind"],
    created_by: String(chain.created_by ?? ""),
    created_at: chain.created_at,
    counts: {
      jobs: chainJobCount(chain),
      assets: chainAssetCount(chain),
    },
    recent_jobs: jobs,
    recent_assets: assets,
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/pipelines/{id}/overview` request. */
export function chainOverviewQueryParams(
  options: ChainOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
