/**
 * Display models for the authoritative job execution statistics (C40/C43
 * follow-up). Every value rendered by `JobStatsPanel` is derived here from the
 * raw `JobStats` payload so empty, partial and populated states stay consistent
 * across mock and live transports and JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values.
 */

import type { JobStats, JobStatus } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { jobStatusLabel, jobStatusTone } from "./helpers";

export interface JobStatsStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface JobStatusStatRow {
  readonly status: JobStatus;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all jobs, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface JobOperationStatRow {
  readonly operationId: string;
  readonly label: string;
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  /** Rounded share of this operation's jobs that succeeded, 0..100. */
  readonly successPercent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly successFraction: number;
  readonly tone: BadgeTone;
}

const STATUS_ORDER: readonly JobStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Format a 0..1 success ratio as a percentage, or an em dash when absent. */
export function formatSuccessRate(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

/** Compact human duration (ms-free seconds/minutes/hours), or an em dash. */
export function formatDurationSeconds(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value < 0) return "—";
  const seconds = Math.round(value);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  if (minutes < 60) {
    return remainderSeconds ? `${minutes}m ${remainderSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return remainderMinutes ? `${hours}h ${remainderMinutes}m` : `${hours}h`;
}

/** The five authoritative counters, in a stable display order. */
export function jobStatsCards(stats?: JobStats): JobStatsStat[] {
  return [
    { key: "total", label: "Total jobs", value: String(stats?.total ?? 0), hint: "Submitted operations" },
    { key: "in_flight", label: "In flight", value: String(stats?.in_flight ?? 0), hint: "Queued + running" },
    { key: "completed", label: "Completed", value: String(stats?.completed ?? 0), hint: "Terminal + canceled" },
    { key: "success_rate", label: "Success rate", value: formatSuccessRate(stats?.success_rate), hint: "Of terminal jobs" },
    {
      key: "avg_duration",
      label: "Avg duration",
      value: formatDurationSeconds(stats?.average_duration_seconds),
      hint: "Timed jobs",
    },
  ];
}

/** Zero-filled status distribution with a share per status. */
export function jobStatusRows(stats?: JobStats): JobStatusStatRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_status ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.status, entry.count);
  }
  const total = STATUS_ORDER.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);
  return STATUS_ORDER.map((status) => {
    const count = counts.get(status) ?? 0;
    const fraction = total > 0 ? count / total : 0;
    return {
      status,
      label: jobStatusLabel(status),
      count,
      fraction: clamp01(fraction),
      percent: Math.round(clamp01(fraction) * 100),
      tone: jobStatusTone(status),
    };
  });
}

/** Human-readable label for a hyphen/underscore operation id. */
export function humanizeOperationId(operationId: string): string {
  return operationId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Per-operation totals/outcomes with a success share, busiest first. */
export function jobOperationRows(stats?: JobStats): JobOperationStatRow[] {
  return (stats?.by_operation ?? [])
    .filter((row) => row && Number.isFinite(row.total))
    .map((row) => {
      const succeeded = Number.isFinite(row.succeeded) ? row.succeeded : 0;
      const failed = Number.isFinite(row.failed) ? row.failed : 0;
      const successFraction = row.total > 0 ? succeeded / row.total : 0;
      let tone: BadgeTone = "neutral";
      if (failed === 0 && succeeded > 0) tone = "success";
      else if (failed > succeeded) tone = "danger";
      else if (succeeded > 0) tone = "warning";
      return {
        operationId: row.operation_id,
        label: humanizeOperationId(row.operation_id),
        total: row.total,
        succeeded,
        failed,
        successPercent: Math.round(clamp01(successFraction) * 100),
        successFraction: clamp01(successFraction),
        tone,
      };
    })
    .sort((a, b) => b.total - a.total || a.operationId.localeCompare(b.operationId));
}

/** True when the snapshot carries at least one job or operation. */
export function hasJobStatsData(stats?: JobStats): boolean {
  if (!stats) return false;
  return (
    stats.total > 0 ||
    stats.in_flight > 0 ||
    stats.completed > 0 ||
    (stats.by_operation?.length ?? 0) > 0
  );
}

/** Compact relative "generated at" label for the snapshot footer. */
export function jobStatsGeneratedAtLabel(stats?: JobStats, now: number = Date.now()): string {
  if (!stats?.generated_at) return "";
  const timestamp = Date.parse(stats.generated_at);
  if (Number.isNaN(timestamp)) return stats.generated_at;
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
