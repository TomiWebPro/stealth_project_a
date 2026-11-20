/**
 * Display models for the authoritative single-pipeline-chain overview (C234/C236/
 * C237 follow-up). The backend derives the whole snapshot fresh from the three
 * authoritative chain collections — the same stores `/pipelines` lists and
 * `/pipelines/stats` aggregates — with linked jobs/assets resolved from the
 * authoritative stores on every call. This module only turns the canonical
 * `ChainOverview` payload and the chain feed (used to populate the picker) into
 * render-ready values so `ChainOverviewPanel` stays free of inline mapping and
 * both transports render identically.
 *
 * Every helper tolerates `undefined` (query not settled / failed / unknown
 * chain) and returns render-safe, zero-filled values. Kind/job/asset labels and
 * tones reuse the existing pipeline, job and operation helpers so the overview
 * cannot drift from the workspace-wide pipeline screens.
 */

import type { ChainOverviewOptions } from "../../lib/chainOverview";
import type { PipelineFeedOptions } from "../../lib/pipelineFeed";
import type { ChainOverview, PipelineFeed, PipelineFeedItem } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { jobStatusLabel, jobStatusTone } from "../jobs/helpers";
import { queueOperationLabel } from "../jobs/jobQueueHelpers";
import { assetTypeLabel } from "../operations/operationStatsHelpers";
import {
  pipelineFeedProjectName,
  shortPipelineChainId,
} from "./pipelineFeedHelpers";
import { pipelineKindLabel, pipelineKindTone } from "./pipelineStatsHelpers";

/** Page size used to populate the chain picker from the authoritative feed. */
export const CHAIN_OVERVIEW_PICKER_LIMIT = 50;

/** Recent-projection chips offered above the overview. */
export const CHAIN_OVERVIEW_RECENT_LIMITS: readonly number[] = [5, 10, 25];

/** Hook options for the bounded recent jobs/assets projection. */
export function chainOverviewOptions(recentLimit?: number): ChainOverviewOptions {
  return recentLimit === undefined ? {} : { recentLimit };
}

/** Feed options used to populate the chain picker, optionally project-scoped. */
export function buildChainPickerFeedOptions(projectId?: string): PipelineFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    limit: CHAIN_OVERVIEW_PICKER_LIMIT,
  };
}

/** A render-ready option for the chain picker. */
export interface ChainPickerOption {
  readonly value: string;
  readonly label: string;
}

/** Compact picker label for one chain feed item. */
export function chainOptionLabel(item: PipelineFeedItem): string {
  return `${pipelineKindLabel(item.kind)} chain · ${shortPipelineChainId(item.chain_id)} · ${pipelineFeedProjectName(item.project_name)}`;
}

/** Map the authoritative chain feed into deterministic picker options. */
export function chainPickerOptions(feed?: PipelineFeed): readonly ChainPickerOption[] {
  return (feed?.items ?? []).map((item) => ({
    value: item.chain_id,
    label: chainOptionLabel(item),
  }));
}

export interface ChainOverviewIdentity {
  readonly kindLabel: string;
  readonly kindTone: BadgeTone;
  readonly chainIdLabel: string;
  readonly projectName: string;
  readonly projectId: string;
  readonly createdByLabel: string;
  readonly createdLabel: string;
}

export interface ChainOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ChainJobRow {
  readonly id: string;
  readonly shortJobId: string;
  readonly operationLabel: string;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly timestamp: string;
  readonly relativeTime: string;
}

export interface ChainAssetRow {
  readonly id: string;
  readonly name: string;
  readonly typeLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Defensive non-negative count for a possibly malformed snapshot field. */
function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

/** Compact relative label for a timestamp, or "" when absent. */
export function chainOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function chainOverviewGeneratedAtLabel(
  overview?: ChainOverview | null,
  now: number = Date.now(),
): string {
  return chainOverviewRelativeLabel(overview?.generated_at, now);
}

/** Whole-scope counts, zero-filled for a missing snapshot. */
export function chainOverviewCounts(overview?: ChainOverview | null): {
  jobs: number;
  assets: number;
} {
  return {
    jobs: nonNegativeCount(overview?.counts?.jobs),
    assets: nonNegativeCount(overview?.counts?.assets),
  };
}

/** Identity, kind badge and project attribution for the snapshot header. */
export function chainOverviewIdentity(
  overview?: ChainOverview | null,
  now: number = Date.now(),
): ChainOverviewIdentity {
  const kind = overview?.kind;
  return {
    kindLabel: kind ? pipelineKindLabel(kind) : "Unknown",
    kindTone: kind ? pipelineKindTone(kind) : "neutral",
    chainIdLabel: shortPipelineChainId(overview?.chain_id),
    projectName: pipelineFeedProjectName(overview?.project_name),
    projectId: overview?.project_id ?? "",
    createdByLabel: overview?.created_by ? shortPipelineChainId(overview.created_by) : "—",
    createdLabel: chainOverviewRelativeLabel(overview?.created_at, now),
  };
}

/** Headline counters: whole-chain totals plus the bounded recent projections. */
export function chainOverviewStatRows(
  overview?: ChainOverview | null,
): ChainOverviewStat[] {
  const counts = chainOverviewCounts(overview);
  return [
    {
      key: "jobs",
      label: "Linked jobs",
      value: String(counts.jobs),
      hint: "Whole-chain job total",
    },
    {
      key: "assets",
      label: "Linked assets",
      value: String(counts.assets),
      hint: "Whole-chain asset total",
    },
    {
      key: "recent-jobs",
      label: "Recent jobs",
      value: String((overview?.recent_jobs ?? []).length),
      hint: "Shown (bounded)",
    },
    {
      key: "recent-assets",
      label: "Recent assets",
      value: String((overview?.recent_assets ?? []).length),
      hint: "Shown (bounded)",
    },
  ];
}

/** Newest-first recent jobs, projected into render-ready rows (wire order kept). */
export function chainJobRows(
  overview?: ChainOverview | null,
  now: number = Date.now(),
): ChainJobRow[] {
  return (overview?.recent_jobs ?? []).map((job) => ({
    id: job.job_id,
    shortJobId: shortPipelineChainId(job.job_id),
    operationLabel: queueOperationLabel(job.operation_id),
    statusLabel: jobStatusLabel(job.status),
    statusTone: jobStatusTone(job.status),
    timestamp: job.created_at,
    relativeTime: chainOverviewRelativeLabel(job.created_at, now),
  }));
}

/** Newest-first recent assets, projected into render-ready rows (wire order kept). */
export function chainAssetRows(
  overview?: ChainOverview | null,
  now: number = Date.now(),
): ChainAssetRow[] {
  return (overview?.recent_assets ?? []).map((asset) => ({
    id: asset.asset_id,
    name: asset.name?.trim() || shortPipelineChainId(asset.asset_id),
    typeLabel: assetTypeLabel(asset.asset_type),
    timestamp: asset.created_at,
    relativeTime: chainOverviewRelativeLabel(asset.created_at, now),
  }));
}

/** One-line summary for the panel header/footer. */
export function chainOverviewSummaryLabel(overview?: ChainOverview | null): string {
  if (!overview) return "";
  const identity = chainOverviewIdentity(overview, 0);
  const counts = chainOverviewCounts(overview);
  return `${identity.kindLabel} chain in ${identity.projectName} · ${counts.jobs} job${counts.jobs === 1 ? "" : "s"} · ${counts.assets} asset${counts.assets === 1 ? "" : "s"}`;
}

/** False only when the snapshot is missing or has no linked activity. */
export function hasChainOverviewData(overview?: ChainOverview | null): boolean {
  if (!overview) return false;
  const counts = chainOverviewCounts(overview);
  return (
    counts.jobs > 0 ||
    counts.assets > 0 ||
    (overview.recent_jobs?.length ?? 0) > 0 ||
    (overview.recent_assets?.length ?? 0) > 0
  );
}
