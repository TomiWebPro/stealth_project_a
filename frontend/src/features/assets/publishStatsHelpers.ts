/**
 * Display models for the authoritative publish statistics (C113/C115/C116
 * follow-up). Every value rendered by `PublishStatsPanel` is derived here from the
 * raw `PublishStats` payload so empty, partial and populated states stay consistent
 * across mock and live transports and JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. Ordering mirrors `lib/publishStats`: `by_version`
 * is ascending by version number and `by_project` is descending by published count
 * then project id, exactly as both transports derive them.
 */

import type {
  PublishProjectCount,
  PublishStats,
  PublishVersionCount,
} from "../../lib/types";
import { formatRelative } from "../home/format";

export interface PublishStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface PublishVersionRow {
  readonly version: number;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all published assets, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

export interface PublishProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly published: number;
  readonly bytesLabel: string;
  /** Rounded share of all published assets, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Human-readable byte size; "—" for missing, negative or invalid values. */
export function formatByteSize(value?: number | null): string {
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
export function publishRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for the newest publish receipt in the snapshot. */
export function newestPublishLabel(stats?: PublishStats, now: number = Date.now()): string {
  return publishRelativeLabel(stats?.newest_published_at, now);
}

/** Compact relative "generated at" label for the snapshot footer. */
export function publishStatsGeneratedAtLabel(
  stats?: PublishStats,
  now: number = Date.now(),
): string {
  return publishRelativeLabel(stats?.generated_at, now);
}

/** Display label for a publish version bucket. */
export function publishVersionLabel(version: number): string {
  return `v${version}`;
}

/** Short, human-friendly label for a project UUID in a compact row. */
export function publishProjectLabel(projectId: string): string {
  if (!projectId) return "Unknown";
  return projectId.length > 8 ? `${projectId.slice(0, 8)}…` : projectId;
}

/** Count of published assets at a given version number. */
export function publishCountFor(stats?: PublishStats, version: number = 1): number {
  const entry = (stats?.by_version ?? []).find(
    (bucket: PublishVersionCount) => Boolean(bucket) && bucket.version === version,
  );
  return entry && Number.isFinite(entry.count) ? entry.count : 0;
}

/**
 * The authoritative publish counters plus coverage signals, in a stable display
 * order. The "Versions" card counts distinct published version numbers and the
 * "Newest" card carries the receipt recency marker.
 */
export function publishStatsCards(
  stats?: PublishStats,
  now: number = Date.now(),
): PublishStatsCard[] {
  return [
    {
      key: "published",
      label: "Published",
      value: String(stats?.total_published ?? 0),
      hint: "Assets with publish receipts",
    },
    {
      key: "delivered",
      label: "Delivered",
      value: formatByteSize(stats?.total_bytes),
      hint: "Bytes in Publish copies",
    },
    {
      key: "versions",
      label: "Versions",
      value: String(validVersionCount(stats)),
      hint: "Distinct publish versions",
    },
    {
      key: "newest",
      label: "Newest publish",
      value: newestPublishLabel(stats, now) || "—",
      hint: "Most recent receipt",
    },
  ];
}

/** Publish-version distribution, deterministically sorted ascending by version. */
export function publishVersionRows(stats?: PublishStats): PublishVersionRow[] {
  const rows = (stats?.by_version ?? [])
    .filter(
      (entry): entry is PublishVersionCount =>
        Boolean(entry) && Number.isFinite(entry.version) && Number.isFinite(entry.count),
    )
    .sort((a, b) => a.version - b.version);
  const total = rows.reduce((sum, entry) => sum + entry.count, 0);
  return rows.map((entry) => {
    const fraction = clamp01(total > 0 ? entry.count / total : 0);
    return {
      version: entry.version,
      label: publishVersionLabel(entry.version),
      count: entry.count,
      fraction,
      percent: Math.round(fraction * 100),
    };
  });
}

/**
 * Per-project publish activity, deterministically sorted by descending published
 * count then project id — matching the authoritative backend/mock ordering.
 */
export function publishProjectRows(stats?: PublishStats): PublishProjectRow[] {
  const total = stats?.total_published ?? 0;
  return (stats?.by_project ?? [])
    .filter(
      (entry): entry is PublishProjectCount =>
        Boolean(entry) &&
        Number.isFinite(entry.published) &&
        Number.isFinite(entry.bytes) &&
        typeof entry.project_id === "string",
    )
    .sort((a, b) => b.published - a.published || a.project_id.localeCompare(b.project_id))
    .map((entry) => {
      const fraction = clamp01(total > 0 ? entry.published / total : 0);
      return {
        projectId: entry.project_id,
        label: publishProjectLabel(entry.project_id),
        published: entry.published,
        bytesLabel: formatByteSize(entry.bytes),
        fraction,
        percent: Math.round(fraction * 100),
      };
    });
}

/** True when the snapshot carries at least one published asset. */
export function hasPublishStatsData(stats?: PublishStats): boolean {
  if (!stats) return false;
  return stats.total_published > 0;
}

/** Count of well-formed publish-version buckets in a snapshot (for parity checks). */
export function validVersionCount(stats?: PublishStats): number {
  return (stats?.by_version ?? []).filter(
    (entry: PublishVersionCount) =>
      Boolean(entry) && Number.isFinite(entry.version) && Number.isFinite(entry.count),
  ).length;
}
