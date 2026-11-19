/**
 * Display models for the authoritative single-project overview (C201/C203/C204
 * follow-up). Every value rendered by `ProjectOverviewPanel` is derived here
 * from the raw `ProjectOverview` snapshot so empty, partial and populated states
 * stay consistent across mock and live transports and the JSX stays free of
 * inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown project)
 * and return zero-filled, render-safe values. The count order mirrors the
 * canonical `ProjectOverviewCounts` contract so the UI always shows a complete
 * cross-domain breakdown.
 */

import type { Asset, Job, ProjectLifecycle, ProjectOverview, ProjectOverviewCounts } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { assetTypeTone, formatRelative, jobStatusTone } from "../home/format";
import { jobStatusLabel } from "../jobs/helpers";
import { queueOperationLabel } from "../jobs/jobQueueHelpers";

export interface ProjectOverviewCountRow {
  readonly key: keyof ProjectOverviewCounts;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ProjectOverviewIdentity {
  readonly lifecycleLabel: string;
  readonly lifecycleTone: BadgeTone;
  readonly createdLabel: string;
  readonly generatedLabel: string;
}

export interface ProjectOverviewJobRow {
  readonly id: string;
  readonly operationLabel: string;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly progressPercent: number;
  readonly relativeTime: string;
  readonly timestamp: string;
}

export interface ProjectOverviewAssetRow {
  readonly id: string;
  readonly name: string;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly versionLabel: string;
  readonly relativeTime: string;
  readonly timestamp: string;
}

const COUNT_DEFS: readonly {
  readonly key: keyof ProjectOverviewCounts;
  readonly label: string;
  readonly hint: string;
}[] = [
  { key: "assets", label: "Assets", hint: "Live, non-deleted" },
  { key: "conversations", label: "Conversations", hint: "Project threads" },
  { key: "jobs", label: "Jobs", hint: "Submitted executions" },
  { key: "comments", label: "Comments", hint: "Collaboration notes" },
  { key: "publishes", label: "Publishes", hint: "Delivered receipts" },
  { key: "versions", label: "Versions", hint: "Asset revisions" },
  { key: "collaborators", label: "Collaborators", hint: "Distinct presence users" },
];

const LIFECYCLE_LABEL: Readonly<Record<ProjectLifecycle, string>> = {
  active: "Active",
  archived: "Archived",
};

const LIFECYCLE_TONE: Readonly<Record<ProjectLifecycle, BadgeTone>> = {
  active: "success",
  archived: "neutral",
};

/** One cross-domain count, zero-filled when the snapshot is absent. */
export function projectOverviewCount(overview?: ProjectOverview | null, key: keyof ProjectOverviewCounts = "assets"): number {
  const value = overview?.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function projectOverviewRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function projectOverviewGeneratedAtLabel(
  overview?: ProjectOverview | null,
  now: number = Date.now(),
): string {
  return projectOverviewRelativeLabel(overview?.generated_at, now);
}

/** Defensive 0..100 percent for a job's 0..1 progress value. */
export function projectOverviewProgressPercent(value?: number | null): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

/** All seven cross-domain counters in a stable, zero-filled display order. */
export function projectOverviewCountRows(overview?: ProjectOverview | null): ProjectOverviewCountRow[] {
  return COUNT_DEFS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    value: String(projectOverviewCount(overview, key)),
  }));
}

/** Lifecycle badge + creation/generation recency for the snapshot header. */
export function projectOverviewIdentity(
  overview?: ProjectOverview | null,
  now: number = Date.now(),
): ProjectOverviewIdentity {
  const lifecycle = overview?.lifecycle;
  return {
    lifecycleLabel: lifecycle ? (LIFECYCLE_LABEL[lifecycle] ?? lifecycle) : "—",
    lifecycleTone: lifecycle ? (LIFECYCLE_TONE[lifecycle] ?? "neutral") : "neutral",
    createdLabel: projectOverviewRelativeLabel(overview?.created_at, now),
    generatedLabel: projectOverviewRelativeLabel(overview?.generated_at, now),
  };
}

/** Newest-first recent jobs projected into render-safe display rows. */
export function projectOverviewRecentJobs(
  overview?: ProjectOverview | null,
  now: number = Date.now(),
): ProjectOverviewJobRow[] {
  return (overview?.recent_jobs ?? []).map((job: Job) => ({
    id: job.id,
    operationLabel: queueOperationLabel(job.operation_id),
    statusLabel: jobStatusLabel(job.status),
    statusTone: jobStatusTone(job.status),
    progressPercent: projectOverviewProgressPercent(job.progress),
    relativeTime: projectOverviewRelativeLabel(job.created_at, now),
    timestamp: job.created_at,
  }));
}

/** Newest-first recent assets projected into render-safe display rows. */
export function projectOverviewRecentAssets(
  overview?: ProjectOverview | null,
  now: number = Date.now(),
): ProjectOverviewAssetRow[] {
  return (overview?.recent_assets ?? []).map((asset: Asset) => ({
    id: asset.id,
    name: asset.name,
    typeLabel: asset.type,
    typeTone: assetTypeTone(asset.type),
    versionLabel: `v${asset.version ?? 1}`,
    relativeTime: projectOverviewRelativeLabel(asset.created_at, now),
    timestamp: asset.created_at,
  }));
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasProjectOverviewData(overview?: ProjectOverview | null): boolean {
  if (!overview) return false;
  const hasCounts = COUNT_DEFS.some(({ key }) => projectOverviewCount(overview, key) > 0);
  return hasCounts || (overview.recent_jobs?.length ?? 0) > 0 || (overview.recent_assets?.length ?? 0) > 0;
}

/** One-line cross-domain summary for the panel footer. */
export function projectOverviewSummaryLabel(overview?: ProjectOverview | null): string {
  if (!overview) return "";
  return [
    `${projectOverviewCount(overview, "assets")} assets`,
    `${projectOverviewCount(overview, "jobs")} jobs`,
    `${projectOverviewCount(overview, "collaborators")} collaborators`,
  ].join(" · ");
}
