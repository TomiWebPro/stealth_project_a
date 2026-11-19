/**
 * Display models for the authoritative project portfolio statistics (C53/C55/C56
 * follow-up). Every value rendered by `ProjectStatsPanel` is derived here from the
 * raw `ProjectStats` payload so empty, partial and populated states stay
 * consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The lifecycle order mirrors the canonical
 * `PROJECT_LIFECYCLES` in `lib/projectStats` so the UI always shows a complete
 * zero-filled breakdown.
 */

import type { ProjectLifecycle, ProjectStats } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface ProjectStatsStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ProjectLifecycleRow {
  readonly lifecycle: ProjectLifecycle;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all projects in scope, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface ProjectDomainRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ProjectAverageRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

const LIFECYCLE_ORDER: readonly ProjectLifecycle[] = ["active", "archived"];

const LIFECYCLE_LABEL: Readonly<Record<ProjectLifecycle, string>> = {
  active: "Active",
  archived: "Archived",
};

const LIFECYCLE_TONE: Readonly<Record<ProjectLifecycle, BadgeTone>> = {
  active: "success",
  archived: "neutral",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function projectStatsRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Format a derived per-project average without noisy trailing zeros. */
export function formatAverage(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value < 0) return "—";
  return String(Math.round(value * 100) / 100);
}

/** The four authoritative portfolio counters, in a stable display order. */
export function projectStatsCards(
  stats?: ProjectStats,
  now: number = Date.now(),
): ProjectStatsStat[] {
  return [
    {
      key: "total",
      label: "Total projects",
      value: String(stats?.total ?? 0),
      hint: "In this scope",
    },
    {
      key: "active",
      label: "Active",
      value: String(stats?.active ?? 0),
      hint: "In production",
    },
    {
      key: "archived",
      label: "Archived",
      value: String(stats?.archived ?? 0),
      hint: "Completed or parked",
    },
    {
      key: "newest",
      label: "Newest project",
      value: projectStatsRelativeLabel(stats?.newest_project_at, now) || "—",
      hint: "Last created",
    },
  ];
}

/** Zero-filled lifecycle distribution with a share per state. */
export function projectLifecycleRows(stats?: ProjectStats): ProjectLifecycleRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_lifecycle ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.lifecycle, entry.count);
  }
  const total = LIFECYCLE_ORDER.reduce((sum, lifecycle) => sum + (counts.get(lifecycle) ?? 0), 0);
  return LIFECYCLE_ORDER.map((lifecycle) => {
    const count = counts.get(lifecycle) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      lifecycle,
      label: LIFECYCLE_LABEL[lifecycle] ?? lifecycle,
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: LIFECYCLE_TONE[lifecycle] ?? "neutral",
    };
  });
}

/** Cross-domain document totals derived from the authoritative stores. */
export function projectDomainRows(stats?: ProjectStats): ProjectDomainRow[] {
  return [
    {
      key: "assets",
      label: "Assets",
      value: String(stats?.total_assets ?? 0),
      hint: "Live, non-deleted",
    },
    {
      key: "conversations",
      label: "Conversations",
      value: String(stats?.total_conversations ?? 0),
      hint: "Discussion threads",
    },
    {
      key: "jobs",
      label: "Jobs",
      value: String(stats?.total_jobs ?? 0),
      hint: "Submitted operations",
    },
  ];
}

/** Per-project averages, zero-filled and render-safe when absent. */
export function projectAverageRows(stats?: ProjectStats): ProjectAverageRow[] {
  return [
    {
      key: "assets",
      label: "Assets / project",
      value: formatAverage(stats?.average_assets_per_project),
      hint: "Mean across projects",
    },
    {
      key: "jobs",
      label: "Jobs / project",
      value: formatAverage(stats?.average_jobs_per_project),
      hint: "Mean across projects",
    },
  ];
}

/** True when the snapshot carries at least one project or domain document. */
export function hasProjectStatsData(stats?: ProjectStats): boolean {
  if (!stats) return false;
  return (
    stats.total > 0 ||
    stats.total_assets > 0 ||
    stats.total_conversations > 0 ||
    stats.total_jobs > 0
  );
}

/** Compact relative "generated at" label for the snapshot footer. */
export function projectStatsGeneratedAtLabel(
  stats?: ProjectStats,
  now: number = Date.now(),
): string {
  return projectStatsRelativeLabel(stats?.generated_at, now);
}
