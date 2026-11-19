/**
 * Display models for the authoritative job event stream statistics (C101/C103/
 * C104 follow-up). Every value rendered by `EventStatsPanel` is derived here from
 * the raw `EventStats` payload so empty, partial and populated states stay
 * consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The type order mirrors `JOB_EVENT_TYPES` in
 * `lib/eventStats` so the UI always shows a complete zero-filled status/
 * progress/intermediate/result/error/log breakdown.
 */

import type {
  EventJobCount,
  EventStats,
  EventTypeCount,
  JobEventType,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface EventStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface EventTypeRow {
  readonly type: JobEventType;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all events, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface EventJobRow {
  readonly jobId: string;
  readonly label: string;
  readonly events: number;
  /** Relative label for this job's newest event. */
  readonly newestLabel: string;
  /** Rounded share of all events, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

const EVENT_TYPE_ORDER: readonly JobEventType[] = [
  "status",
  "progress",
  "intermediate",
  "result",
  "error",
  "log",
];

const EVENT_TYPE_LABELS: Readonly<Record<JobEventType, string>> = {
  status: "Status",
  progress: "Progress",
  intermediate: "Intermediate",
  result: "Result",
  error: "Error",
  log: "Log",
};

const EVENT_TYPE_TONES: Readonly<Record<JobEventType, BadgeTone>> = {
  status: "info",
  progress: "accent",
  intermediate: "accent",
  result: "success",
  error: "danger",
  log: "neutral",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function eventRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for the newest event in the snapshot. */
export function newestEventLabel(stats?: EventStats, now: number = Date.now()): string {
  return eventRelativeLabel(stats?.newest_event_at, now);
}

/** Compact relative "generated at" label for the snapshot footer. */
export function eventStatsGeneratedAtLabel(
  stats?: EventStats,
  now: number = Date.now(),
): string {
  return eventRelativeLabel(stats?.generated_at, now);
}

/** Human label for a canonical job event type. */
export function eventTypeLabel(type: JobEventType): string {
  return EVENT_TYPE_LABELS[type] ?? "Event";
}

/** Short, human-friendly label for a job UUID in a compact row. */
export function eventJobLabel(jobId: string): string {
  if (!jobId) return "Unknown";
  return jobId.length > 8 ? `${jobId.slice(0, 8)}…` : jobId;
}

/** Count of events of a canonical type in the authoritative breakdown. */
export function eventTypeCount(stats?: EventStats, type: JobEventType = "error"): number {
  const entry = (stats?.by_type ?? []).find(
    (bucket: EventTypeCount) => Boolean(bucket) && bucket.type === type,
  );
  return entry && Number.isFinite(entry.count) ? entry.count : 0;
}

/**
 * The authoritative totals plus error-pressure and recency signals. `Errors` is
 * the error-type share of all events, so a snapshot with no events reads 0%.
 */
export function eventStatsCards(
  stats?: EventStats,
  now: number = Date.now(),
): EventStatsCard[] {
  const total = stats?.total_events ?? 0;
  const errors = eventTypeCount(stats, "error");
  const errorFraction = clamp01(total > 0 ? errors / total : 0);
  return [
    {
      key: "events",
      label: "Events",
      value: String(total),
      hint: "Total job events",
    },
    {
      key: "jobs",
      label: "Emitting jobs",
      value: String(stats?.total_jobs ?? 0),
      hint: "Jobs with events",
    },
    {
      key: "errors",
      label: "Errors",
      value: `${Math.round(errorFraction * 100)}%`,
      hint: `${errors} error events`,
    },
    {
      key: "newest",
      label: "Newest event",
      value: newestEventLabel(stats, now) || "—",
      hint: "Most recent signal",
    },
  ];
}

/** Zero-filled status/progress/intermediate/result/error/log distribution. */
export function eventTypeRows(stats?: EventStats): EventTypeRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_type ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.type, entry.count);
  }
  const total = EVENT_TYPE_ORDER.reduce((sum, type) => sum + (counts.get(type) ?? 0), 0);
  return EVENT_TYPE_ORDER.map((type) => {
    const count = counts.get(type) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      type,
      label: eventTypeLabel(type),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: EVENT_TYPE_TONES[type] ?? "neutral",
    };
  });
}

/**
 * Per-job event activity, deterministically sorted by descending event count
 * then job id — matching the authoritative backend/mock ordering.
 */
export function eventJobRows(stats?: EventStats, now: number = Date.now()): EventJobRow[] {
  const total = stats?.total_events ?? 0;
  return (stats?.by_job ?? [])
    .filter(
      (entry): entry is EventJobCount =>
        Boolean(entry) && Number.isFinite(entry.events) && typeof entry.job_id === "string",
    )
    .sort((a, b) => b.events - a.events || a.job_id.localeCompare(b.job_id))
    .map((entry) => {
      const fraction = clamp01(total > 0 ? entry.events / total : 0);
      return {
        jobId: entry.job_id,
        label: eventJobLabel(entry.job_id),
        events: entry.events,
        newestLabel: eventRelativeLabel(entry.newest_event_at, now),
        fraction,
        percent: Math.round(fraction * 100),
      };
    });
}

/** True when the snapshot carries at least one job event. */
export function hasEventStatsData(stats?: EventStats): boolean {
  if (!stats) return false;
  return stats.total_events > 0;
}

/** Count of well-formed event-type buckets in a snapshot (for parity checks). */
export function validEventTypeCount(stats?: EventStats): number {
  return (stats?.by_type ?? []).filter(
    (entry: EventTypeCount) => Boolean(entry) && Number.isFinite(entry.count),
  ).length;
}
