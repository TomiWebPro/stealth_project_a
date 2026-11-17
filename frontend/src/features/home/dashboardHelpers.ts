import type { AssetType, DashboardSummary, JobStatus } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { assetTypeTone, formatRelative, jobStatusTone } from "./format";

/**
 * Display models for the authoritative workspace snapshot (C25/C27 follow-up).
 *
 * Every value rendered by the dashboard card is derived here from the raw
 * `DashboardSummary` payload so empty/populated/partial states stay consistent
 * across mock and live transports and JSX stays free of inline derivation.
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values.
 */

export interface DashboardStat {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly hint: string;
}

export interface DashboardBreakdownRow {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  /** Rounded share of the category total, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

export interface DashboardJobRow {
  readonly id: string;
  readonly label: string;
  readonly status: JobStatus;
  readonly tone: BadgeTone;
  /** 0..100 job progress, clamped for determinate display. */
  readonly progress: number;
  readonly when: string;
}

export interface DashboardAssetRow {
  readonly id: string;
  readonly name: string;
  readonly type: AssetType;
  readonly tone: BadgeTone;
  readonly when: string;
}

const JOB_STATUS_LABELS: readonly (readonly [JobStatus, string])[] = [
  ["queued", "Queued"],
  ["running", "Running"],
  ["succeeded", "Succeeded"],
  ["failed", "Failed"],
  ["canceled", "Canceled"],
];

const ASSET_TYPE_LABELS: readonly (readonly [AssetType, string])[] = [
  ["image", "Image"],
  ["video", "Video"],
  ["audio", "Audio"],
  ["model3d", "Model 3D"],
  ["splat", "Splat"],
  ["texture", "Texture"],
  ["dataset", "Dataset"],
  ["lora", "LoRA"],
  ["scene", "Scene"],
  ["resource", "Resource"],
];

function clampProgress(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value ?? 0)));
}

function breakdown(
  labels: readonly (readonly [string, string])[],
  counts: Record<string, number> | undefined,
): DashboardBreakdownRow[] {
  const total = counts
    ? Object.values(counts).reduce((sum, count) => sum + (Number.isFinite(count) ? count : 0), 0)
    : 0;
  return labels.map(([key, label]) => {
    const count = counts?.[key] ?? 0;
    const fraction = total > 0 ? count / total : 0;
    return {
      key,
      label,
      count,
      percent: Math.round(fraction * 100),
      fraction: Math.min(1, Math.max(0, fraction)),
    };
  });
}

/** The six authoritative entity counters, in a stable display order. */
export function dashboardStats(summary?: DashboardSummary): DashboardStat[] {
  const counts = summary?.counts;
  return [
    { key: "projects", label: "Projects", value: counts?.projects ?? 0, hint: "Production workspaces" },
    { key: "assets", label: "Assets", value: counts?.assets ?? 0, hint: "Non-deleted assets" },
    { key: "conversations", label: "Conversations", value: counts?.conversations ?? 0, hint: "Chat threads" },
    { key: "jobs", label: "Jobs", value: counts?.jobs ?? 0, hint: "Submitted operations" },
    { key: "providers", label: "Providers", value: counts?.providers ?? 0, hint: "Execution backends" },
    {
      key: "enabled_extensions",
      label: "Extensions",
      value: counts?.enabled_extensions ?? 0,
      hint: "Enabled extensions",
    },
  ];
}

/** Zero-filled job-status distribution with a share per status. */
export function jobStatusBreakdown(summary?: DashboardSummary): DashboardBreakdownRow[] {
  return breakdown(JOB_STATUS_LABELS, summary?.jobs_by_status);
}

/** Zero-filled asset-type distribution with a share per type. */
export function assetTypeBreakdown(summary?: DashboardSummary): DashboardBreakdownRow[] {
  return breakdown(ASSET_TYPE_LABELS, summary?.assets_by_type);
}

/** Compact, newest-first job rows from the snapshot's `recent_jobs`. */
export function recentJobRows(summary?: DashboardSummary, now: number = Date.now()): DashboardJobRow[] {
  return (summary?.recent_jobs ?? []).map((job) => ({
    id: job.id,
    label: job.operation_id,
    status: job.status,
    tone: jobStatusTone(job.status),
    progress: clampProgress(job.progress),
    when: formatRelative(job.created_at, now),
  }));
}

/** Compact, newest-first asset rows from the snapshot's `recent_assets`. */
export function recentAssetRows(
  summary?: DashboardSummary,
  now: number = Date.now(),
): DashboardAssetRow[] {
  return (summary?.recent_assets ?? []).map((asset) => ({
    id: asset.id,
    name: asset.name,
    type: asset.type,
    tone: assetTypeTone(asset.type),
    when: formatRelative(asset.created_at, now),
  }));
}

/** Human-readable "generated at" label for the snapshot footer. */
export function generatedAtLabel(
  summary?: DashboardSummary,
  now: number = Date.now(),
): string {
  return summary ? formatRelative(summary.generated_at, now) : "";
}

/** True when any authoritative count or recent item is non-empty. */
export function hasDashboardData(summary?: DashboardSummary): boolean {
  if (!summary) return false;
  if (dashboardStats(summary).some((stat) => stat.value > 0)) return true;
  return (summary.recent_jobs?.length ?? 0) > 0 || (summary.recent_assets?.length ?? 0) > 0;
}
