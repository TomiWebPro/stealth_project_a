/**
 * Authoritative dashboard-summary derivation + query helpers (C25 follow-up).
 *
 * The backend (`DashboardRepository`) derives the whole snapshot from its
 * authoritative stores on every call — there is no second index. `lib/dashboard`
 * reproduces that derivation exactly so mock mode stays at feature parity with
 * live mode and the parity guard can drive both transports over the same seeds.
 */

import { ApiError } from "../api/client";
import type { DashboardSummary } from "./types";
import type { Asset, AssetType, Conversation, Extension, Job, JobStatus, Project, Provider } from "./types";

/** Optional filter mirrored from the authoritative `/dashboard` endpoint. */
export interface DashboardOptions {
  readonly recentLimit?: number;
}

/** Zero-filled so UI badges can read `jobs_by_status["running"]` directly. */
export const JOB_STATUSES: readonly JobStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
];

export const ASSET_TYPES: readonly AssetType[] = [
  "image",
  "video",
  "audio",
  "model3d",
  "splat",
  "texture",
  "dataset",
  "lora",
  "scene",
  "resource",
];

export const DEFAULT_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's `recent_limit` validation (ge=1, le=50) so mock and live
 * fail identically with the shared normalized error envelope.
 */
export function validateDashboardArgs(recentLimit?: number): void {
  if (
    recentLimit !== undefined &&
    (!Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > MAX_RECENT_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Dashboard recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface DashboardSeeds {
  readonly projects: readonly Project[];
  readonly assets: readonly Asset[];
  readonly conversations: readonly Conversation[];
  readonly jobs: readonly Job[];
  readonly providers: readonly Provider[];
  readonly extensions: readonly Extension[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

/** Newest-first by `(created_at, id)`, mirroring the repository's reverse sort. */
function newestFirst<T extends { created_at: string; id: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || String(b.id).localeCompare(String(a.id)),
  );
}

/**
 * Derive a workspace snapshot exactly as the backend repository does: deleted
 * assets are excluded from counts, breakdowns and recency, and empty seeds yield
 * zero counts + zero-filled breakdowns + empty `recent_*` lists (never an error).
 */
export function deriveDashboardSummary(
  seeds: DashboardSeeds,
  options: DashboardOptions = {},
): DashboardSummary {
  const { projects, conversations, jobs, providers, extensions, now } = seeds;
  const assets = seeds.assets.filter((asset) => asset.status !== "deleted");
  const recentLimit = options.recentLimit ?? DEFAULT_RECENT_LIMIT;

  const jobsByStatus: Record<string, number> = {};
  for (const status of JOB_STATUSES) jobsByStatus[status] = 0;
  for (const job of jobs) jobsByStatus[job.status] = (jobsByStatus[job.status] ?? 0) + 1;

  const assetsByType: Record<string, number> = {};
  for (const type of ASSET_TYPES) assetsByType[type] = 0;
  for (const asset of assets) assetsByType[asset.type] = (assetsByType[asset.type] ?? 0) + 1;

  return {
    counts: {
      projects: projects.length,
      assets: assets.length,
      conversations: conversations.length,
      jobs: jobs.length,
      providers: providers.length,
      enabled_extensions: extensions.filter((extension) => extension.status === "enabled").length,
    },
    generated_at: now,
    jobs_by_status: jobsByStatus,
    assets_by_type: assetsByType,
    recent_jobs: newestFirst(jobs).slice(0, recentLimit),
    recent_assets: newestFirst(assets).slice(0, recentLimit),
  };
}

/** Query-string values for the live `/dashboard` request. */
export function dashboardQueryParams(
  options: DashboardOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
