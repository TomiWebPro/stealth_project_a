/**
 * Display models for the authoritative activity statistics (C89/C91/C92
 * follow-up). Every value rendered by `ActivityStatsPanel` is derived here from
 * the raw `ActivityStats` payload so empty, partial and populated states stay
 * consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The activity-kind order mirrors the canonical
 * `ACTIVITY_STAT_KINDS` in `lib/activityStats` so the UI always shows a complete
 * zero-filled breakdown.
 */

import type { ActivityKind, ActivityProjectCount, ActivityStats } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { ACTIVITY_KIND_LABELS } from "./activityHelpers";

export interface ActivityStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface ActivityKindRow {
  readonly kind: ActivityKind;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all scoped events, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface ActivityProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly events: number;
  readonly participants: number;
}

const KIND_ORDER: readonly ActivityKind[] = ["asset", "publish", "job", "comment"];

const KIND_TONE: Readonly<Record<ActivityKind, BadgeTone>> = {
  asset: "accent",
  publish: "success",
  job: "warning",
  comment: "info",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function activityRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Short, stable label for a project id when no friendly name is known. */
export function shortActivityProjectId(projectId: string): string {
  return projectId.length > 8 ? `${projectId.slice(0, 8)}…` : projectId;
}

/** Relative label for the newest activity event in the snapshot. */
export function newestEventLabel(stats?: ActivityStats, now: number = Date.now()): string {
  return activityRelativeLabel(stats?.newest_event_at, now);
}

/** The authoritative counters plus active-project and newest-event signals. */
export function activityStatsCards(
  stats?: ActivityStats,
  now: number = Date.now(),
): ActivityStatsCard[] {
  return [
    {
      key: "events",
      label: "Events",
      value: String(stats?.total_events ?? 0),
      hint: "All recorded activity",
    },
    {
      key: "participants",
      label: "Participants",
      value: String(stats?.total_participants ?? 0),
      hint: "Distinct actors",
    },
    {
      key: "latest",
      label: "Latest event",
      value: newestEventLabel(stats, now) || "—",
      hint: "Most recent signal",
    },
    {
      key: "projects",
      label: "Active projects",
      value: String(stats?.by_project?.length ?? 0),
      hint: "Projects with activity",
    },
  ];
}

/** Zero-filled asset/publish/job/comment distribution with a share per kind. */
export function activityKindRows(stats?: ActivityStats): ActivityKindRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_kind ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.kind, entry.count);
  }
  const total = KIND_ORDER.reduce((sum, kind) => sum + (counts.get(kind) ?? 0), 0);
  return KIND_ORDER.map((kind) => {
    const count = counts.get(kind) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      kind,
      label: ACTIVITY_KIND_LABELS[kind] ?? "Event",
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: KIND_TONE[kind] ?? "neutral",
    };
  });
}

/**
 * Per-project event/participant activity with a share of all events. Rows keep
 * the backend's deterministic (descending events, then project id) order;
 * friendly names are resolved through `projectNames` and fall back to a short id.
 */
export function activityProjectRows(
  stats?: ActivityStats,
  projectNames: Readonly<Record<string, string>> = {},
): ActivityProjectRow[] {
  return [...(stats?.by_project ?? [])]
    .filter(
      (entry): entry is ActivityProjectCount =>
        Boolean(entry) && Number.isFinite(entry.events) && Number.isFinite(entry.participants),
    )
    .sort((a, b) => b.events - a.events || a.project_id.localeCompare(b.project_id))
    .map((entry) => ({
      projectId: entry.project_id,
      label: projectNames[entry.project_id] || shortActivityProjectId(entry.project_id),
      events: entry.events,
      participants: entry.participants,
    }));
}

/** True when the snapshot carries any event or participant. */
export function hasActivityStatsData(stats?: ActivityStats): boolean {
  if (!stats) return false;
  return stats.total_events > 0 || stats.total_participants > 0;
}

/** Compact relative "generated at" label for the snapshot footer. */
export function activityStatsGeneratedAtLabel(
  stats?: ActivityStats,
  now: number = Date.now(),
): string {
  return activityRelativeLabel(stats?.generated_at, now);
}
