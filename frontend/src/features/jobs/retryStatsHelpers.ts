/**
 * Display models for the authoritative job retry statistics (C105/C107/C108
 * follow-up). Every value rendered by `RetryStatsPanel` is derived here from the
 * raw `RetryStats` payload so empty, partial and populated states stay
 * consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The status order mirrors `JOB_STATUSES` in
 * `lib/retryStats` so the UI always shows a complete zero-filled
 * queued/running/succeeded/failed/canceled breakdown.
 */

import type {
  JobStatus,
  RetryProjectCount,
  RetryStats,
  RetryStatusCount,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface RetryStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface RetryStatusRow {
  readonly status: JobStatus;
  readonly label: string;
  readonly jobs: number;
  /** Rounded share of all retried jobs, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface RetryProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly retries: number;
  readonly jobs: number;
  /** Rounded share of all retries, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

const RETRY_STATUS_ORDER: readonly JobStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
];

const RETRY_STATUS_LABELS: Readonly<Record<JobStatus, string>> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

const RETRY_STATUS_TONES: Readonly<Record<JobStatus, BadgeTone>> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  canceled: "neutral",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function retryRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for the newest retried-job activity in the snapshot. */
export function newestRetryLabel(stats?: RetryStats, now: number = Date.now()): string {
  return retryRelativeLabel(stats?.newest_retry_at, now);
}

/** Compact relative "generated at" label for the snapshot footer. */
export function retryStatsGeneratedAtLabel(
  stats?: RetryStats,
  now: number = Date.now(),
): string {
  return retryRelativeLabel(stats?.generated_at, now);
}

/** Human label for a canonical job status. */
export function retryStatusLabel(status: JobStatus): string {
  return RETRY_STATUS_LABELS[status] ?? "Job";
}

/** Short, human-friendly label for a project UUID in a compact row. */
export function retryProjectLabel(projectId: string): string {
  if (!projectId) return "Unknown";
  return projectId.length > 8 ? `${projectId.slice(0, 8)}…` : projectId;
}

/** Count of retried jobs currently in one lifecycle status. */
export function retryStatusCount(
  stats?: RetryStats,
  status: JobStatus = "failed",
): number {
  const entry = (stats?.by_status ?? []).find(
    (bucket: RetryStatusCount) => Boolean(bucket) && bucket.status === status,
  );
  return entry && Number.isFinite(entry.jobs) ? entry.jobs : 0;
}

/**
 * Authoritative totals plus failure-pressure and recency signals. `Failed` is
 * the share of retried jobs currently in the failed status, so a snapshot with
 * no retried jobs reads 0%.
 */
export function retryStatsCards(
  stats?: RetryStats,
  now: number = Date.now(),
): RetryStatsCard[] {
  const jobs = stats?.total_jobs ?? 0;
  const failed = retryStatusCount(stats, "failed");
  const failedFraction = clamp01(jobs > 0 ? failed / jobs : 0);
  return [
    {
      key: "retries",
      label: "Retries",
      value: String(stats?.total_retries ?? 0),
      hint: "Accepted retries",
    },
    {
      key: "jobs",
      label: "Retried jobs",
      value: String(jobs),
      hint: "Distinct retried jobs",
    },
    {
      key: "failed",
      label: "Failed now",
      value: `${Math.round(failedFraction * 100)}%`,
      hint: `${failed} retried jobs failed`,
    },
    {
      key: "newest",
      label: "Newest retry",
      value: newestRetryLabel(stats, now) || "—",
      hint: "Most recent activity",
    },
  ];
}

/** Zero-filled queued/running/succeeded/failed/canceled retried-job distribution. */
export function retryStatusRows(stats?: RetryStats): RetryStatusRow[] {
  const counts = new Map<JobStatus, number>();
  for (const entry of stats?.by_status ?? []) {
    if (entry && Number.isFinite(entry.jobs)) counts.set(entry.status, entry.jobs);
  }
  const total = RETRY_STATUS_ORDER.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);
  return RETRY_STATUS_ORDER.map((status) => {
    const count = counts.get(status) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      status,
      label: retryStatusLabel(status),
      jobs: count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: RETRY_STATUS_TONES[status] ?? "neutral",
    };
  });
}

/**
 * Per-project retry activity, deterministically sorted by descending retry
 * count then project id — matching the authoritative backend/mock ordering.
 */
export function retryProjectRows(stats?: RetryStats): RetryProjectRow[] {
  const total = stats?.total_retries ?? 0;
  return (stats?.by_project ?? [])
    .filter(
      (entry): entry is RetryProjectCount =>
        Boolean(entry) &&
        Number.isFinite(entry.retries) &&
        Number.isFinite(entry.jobs) &&
        typeof entry.project_id === "string",
    )
    .sort((a, b) => b.retries - a.retries || a.project_id.localeCompare(b.project_id))
    .map((entry) => {
      const fraction = clamp01(total > 0 ? entry.retries / total : 0);
      return {
        projectId: entry.project_id,
        label: retryProjectLabel(entry.project_id),
        retries: entry.retries,
        jobs: entry.jobs,
        fraction,
        percent: Math.round(fraction * 100),
      };
    });
}

/** True when the snapshot carries at least one accepted retry. */
export function hasRetryStatsData(stats?: RetryStats): boolean {
  if (!stats) return false;
  return stats.total_retries > 0;
}

/** Count of well-formed retry-status buckets in a snapshot (for parity checks). */
export function validRetryStatusCount(stats?: RetryStats): number {
  return (stats?.by_status ?? []).filter(
    (entry: RetryStatusCount) => Boolean(entry) && Number.isFinite(entry.jobs),
  ).length;
}
