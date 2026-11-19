/**
 * Display models for the authoritative asset version statistics (C109/C111/C112
 * follow-up). Every value rendered by `VersionStatsPanel` is derived here from the
 * raw `VersionStats` payload so empty, partial and populated states stay consistent
 * across mock and live transports and JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. Ordering mirrors `lib/versionStats` so the UI
 * shows `by_version` ascending by version number and `by_project` descending by
 * version count then project id, exactly as both transports derive them.
 */

import type {
  VersionNumberCount,
  VersionProjectCount,
  VersionStats,
} from "../../lib/types";
import { formatRelative } from "../home/format";

export interface VersionStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface VersionNumberRow {
  readonly version: number;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all version records, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

export interface VersionProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly versions: number;
  readonly assets: number;
  /** Rounded share of all version records, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function versionRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for the newest version activity in the snapshot. */
export function newestVersionLabel(stats?: VersionStats, now: number = Date.now()): string {
  return versionRelativeLabel(stats?.newest_version_at, now);
}

/** Compact relative "generated at" label for the snapshot footer. */
export function versionStatsGeneratedAtLabel(
  stats?: VersionStats,
  now: number = Date.now(),
): string {
  return versionRelativeLabel(stats?.generated_at, now);
}

/** Display label for a version number bucket. */
export function versionNumberLabel(version: number): string {
  return `v${version}`;
}

/** Short, human-friendly label for a project UUID in a compact row. */
export function versionProjectLabel(projectId: string): string {
  if (!projectId) return "Unknown";
  return projectId.length > 8 ? `${projectId.slice(0, 8)}…` : projectId;
}

/** Count of version records that share a version number. */
export function versionCountFor(stats?: VersionStats, version: number = 1): number {
  const entry = (stats?.by_version ?? []).find(
    (bucket: VersionNumberCount) => Boolean(bucket) && bucket.version === version,
  );
  return entry && Number.isFinite(entry.count) ? entry.count : 0;
}

/**
 * The four authoritative version counters, in a stable display order. Revisions
 * are records at v2+ and the newest-version card carries the recency signal.
 */
export function versionStatsCards(
  stats?: VersionStats,
  now: number = Date.now(),
): VersionStatsCard[] {
  return [
    {
      key: "versions",
      label: "Total versions",
      value: String(stats?.total_versions ?? 0),
      hint: "Recorded version entries",
    },
    {
      key: "assets",
      label: "Versioned assets",
      value: String(stats?.total_assets ?? 0),
      hint: "Distinct assets with versions",
    },
    {
      key: "revisions",
      label: "Revisions",
      value: String(stats?.revisions ?? 0),
      hint: "Versions at v2 or later",
    },
    {
      key: "newest",
      label: "Newest version",
      value: newestVersionLabel(stats, now) || "—",
      hint: "Most recent entry",
    },
  ];
}

/** Version-number distribution, deterministically sorted ascending by version. */
export function versionNumberRows(stats?: VersionStats): VersionNumberRow[] {
  const rows = (stats?.by_version ?? [])
    .filter(
      (entry): entry is VersionNumberCount =>
        Boolean(entry) && Number.isFinite(entry.version) && Number.isFinite(entry.count),
    )
    .sort((a, b) => a.version - b.version);
  const total = rows.reduce((sum, entry) => sum + entry.count, 0);
  return rows.map((entry) => {
    const fraction = clamp01(total > 0 ? entry.count / total : 0);
    return {
      version: entry.version,
      label: versionNumberLabel(entry.version),
      count: entry.count,
      fraction,
      percent: Math.round(fraction * 100),
    };
  });
}

/**
 * Per-project version activity, deterministically sorted by descending version
 * count then project id — matching the authoritative backend/mock ordering.
 */
export function versionProjectRows(stats?: VersionStats): VersionProjectRow[] {
  const total = stats?.total_versions ?? 0;
  return (stats?.by_project ?? [])
    .filter(
      (entry): entry is VersionProjectCount =>
        Boolean(entry) &&
        Number.isFinite(entry.versions) &&
        Number.isFinite(entry.assets) &&
        typeof entry.project_id === "string",
    )
    .sort((a, b) => b.versions - a.versions || a.project_id.localeCompare(b.project_id))
    .map((entry) => {
      const fraction = clamp01(total > 0 ? entry.versions / total : 0);
      return {
        projectId: entry.project_id,
        label: versionProjectLabel(entry.project_id),
        versions: entry.versions,
        assets: entry.assets,
        fraction,
        percent: Math.round(fraction * 100),
      };
    });
}

/** True when the snapshot carries at least one version record. */
export function hasVersionStatsData(stats?: VersionStats): boolean {
  if (!stats) return false;
  return stats.total_versions > 0;
}

/** Count of well-formed version-number buckets in a snapshot (for parity checks). */
export function validVersionNumberCount(stats?: VersionStats): number {
  return (stats?.by_version ?? []).filter(
    (entry: VersionNumberCount) =>
      Boolean(entry) && Number.isFinite(entry.version) && Number.isFinite(entry.count),
  ).length;
}
