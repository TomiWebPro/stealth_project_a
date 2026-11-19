/**
 * Display models for the authoritative upload statistics (C97/C99/C100
 * follow-up). Every value rendered by `UploadStatsPanel` is derived here from the
 * raw `UploadStats` payload so empty, partial and populated states stay consistent
 * across mock and live transports and JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The status order mirrors the canonical
 * `UPLOAD_STATUSES` in `lib/uploadStats` so the UI always shows a complete
 * zero-filled pending/complete breakdown.
 */

import type {
  UploadProjectCount,
  UploadStats,
  UploadStatus,
  UploadStatusCount,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface UploadStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface UploadStatusRow {
  readonly status: UploadStatus;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all tickets, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface UploadProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly total: number;
  readonly completed: number;
  readonly bytesLabel: string;
  /** Rounded completed/tickets share, 0..100. */
  readonly completionPercent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

const STATUS_ORDER: readonly UploadStatus[] = ["pending", "complete"];

const STATUS_LABELS: Readonly<Record<UploadStatus, string>> = {
  pending: "Pending",
  complete: "Complete",
};

const STATUS_TONE: Readonly<Record<UploadStatus, BadgeTone>> = {
  pending: "warning",
  complete: "success",
};

/** Badge tone for a canonical upload ticket status (shared by stats + feed). */
export function uploadStatusTone(status: UploadStatus): BadgeTone {
  return STATUS_TONE[status] ?? "neutral";
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Human-readable byte size; "—" for missing, negative or invalid values. */
export function formatBytes(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let amount = value / 1024;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(1)} ${units[unit]}`;
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function uploadRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for the newest upload ticket in the snapshot. */
export function newestUploadLabel(stats?: UploadStats, now: number = Date.now()): string {
  return uploadRelativeLabel(stats?.newest_upload_at, now);
}

/** Compact relative "generated at" label for the snapshot footer. */
export function uploadStatsGeneratedAtLabel(
  stats?: UploadStats,
  now: number = Date.now(),
): string {
  return uploadRelativeLabel(stats?.generated_at, now);
}

/** Human label for a canonical upload ticket status. */
export function uploadStatusLabel(status: UploadStatus): string {
  return STATUS_LABELS[status] ?? "Ticket";
}

/**
 * The authoritative totals plus upload-coverage signals. `Completion` is the
 * completed/tickets share, so a snapshot with no tickets reads 0%.
 */
export function uploadStatsCards(stats?: UploadStats, now: number = Date.now()): UploadStatsCard[] {
  const total = stats?.total_tickets ?? 0;
  const completed = stats?.completed ?? 0;
  const completion = clamp01(total > 0 ? completed / total : 0);
  return [
    {
      key: "tickets",
      label: "Tickets",
      value: String(total),
      hint: "Total upload tickets",
    },
    {
      key: "uploaded",
      label: "Uploaded",
      value: formatBytes(stats?.bytes_uploaded),
      hint: "Completed bytes",
    },
    {
      key: "completion",
      label: "Completion",
      value: `${Math.round(completion * 100)}%`,
      hint: "Tickets completed",
    },
    {
      key: "newest",
      label: "Newest upload",
      value: newestUploadLabel(stats, now) || "—",
      hint: "Most recent ticket",
    },
  ];
}

/** Zero-filled pending/complete distribution with a share per status. */
export function uploadStatusRows(stats?: UploadStats): UploadStatusRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_status ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.status, entry.count);
  }
  const total = STATUS_ORDER.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);
  return STATUS_ORDER.map((status) => {
    const count = counts.get(status) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      status,
      label: uploadStatusLabel(status),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: uploadStatusTone(status),
    };
  });
}

/** Short, human-friendly label for a project UUID in a compact row. */
export function uploadProjectLabel(projectId: string): string {
  if (!projectId) return "Unknown";
  return projectId.length > 8 ? `${projectId.slice(0, 8)}…` : projectId;
}

/**
 * Per-project ticket activity, deterministically sorted by descending ticket
 * count then project id — matching the authoritative backend/mock ordering.
 */
export function uploadProjectRows(stats?: UploadStats): UploadProjectRow[] {
  return (stats?.by_project ?? [])
    .filter(
      (entry): entry is UploadProjectCount => Boolean(entry) && Number.isFinite(entry.total),
    )
    .sort((a, b) => b.total - a.total || a.project_id.localeCompare(b.project_id))
    .map((entry) => {
      const completed = Number.isFinite(entry.completed) ? entry.completed : 0;
      const fraction = clamp01(entry.total > 0 ? completed / entry.total : 0);
      return {
        projectId: entry.project_id,
        label: uploadProjectLabel(entry.project_id),
        total: entry.total,
        completed,
        bytesLabel: formatBytes(entry.bytes_uploaded),
        completionPercent: Math.round(fraction * 100),
        fraction,
      };
    });
}

/** True when the snapshot carries at least one upload ticket. */
export function hasUploadStatsData(stats?: UploadStats): boolean {
  if (!stats) return false;
  return stats.total_tickets > 0;
}

/** Count of well-formed status buckets in a snapshot (for parity checks). */
export function validUploadStatusCount(stats?: UploadStats): number {
  return (stats?.by_status ?? []).filter(
    (entry: UploadStatusCount) => Boolean(entry) && Number.isFinite(entry.count),
  ).length;
}
