/**
 * Display models for the authoritative single-job overview (C213/C215/C216
 * follow-up). Every value rendered by `JobOverviewPanel` is derived here from the
 * raw `JobOverview` snapshot so loading/error/missing/empty/populated states stay
 * consistent across mock and live transports and the JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown job) and
 * return zero-filled, render-safe values. The event-type breakdown reuses the
 * canonical `eventStatsHelpers` projection so the overview can never drift from
 * the workspace-wide event-stats view.
 */

import type {
  EventStats,
  JobEvent,
  JobOverview,
  JobStatus,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import {
  eventRelativeLabel,
  eventTypeLabel,
  eventTypeRows,
  type EventTypeRow,
} from "./eventStatsHelpers";
import { jobStatusLabel, jobStatusTone } from "./helpers";
import { queueOperationLabel } from "./jobQueueHelpers";

export interface JobOverviewIdentity {
  readonly jobIdLabel: string;
  readonly operationLabel: string;
  readonly projectLabel: string;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly attemptLabel: string;
  readonly schemaLabel: string;
  readonly progressPercent: number;
  readonly progressFraction: number;
  readonly errorLabel: string;
  readonly resultLabel: string;
  readonly createdLabel: string;
  readonly startedLabel: string;
  readonly finishedLabel: string;
}

export interface JobOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface JobOverviewRecentEvent {
  readonly id: string;
  readonly seq: number;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly message: string;
  readonly progressPercent: number;
  readonly timestamp: string;
  readonly relativeTime: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

/** Compact relative label for a timestamp, or "" when absent. */
export function jobOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function jobOverviewGeneratedAtLabel(
  overview?: JobOverview | null,
  now: number = Date.now(),
): string {
  return jobOverviewRelativeLabel(overview?.generated_at, now);
}

/** Authoritative event total (never bounded by the recent-events page). */
export function jobOverviewEventCount(overview?: JobOverview | null): number {
  return nonNegativeCount(overview?.counts?.events);
}

/** Authoritative accepted-retry total (never bounded by the recent-events page). */
export function jobOverviewRetryCount(overview?: JobOverview | null): number {
  return nonNegativeCount(overview?.counts?.retries);
}

/** Normalized 0..1 progress value for an accessible progress bar. */
export function jobOverviewProgressFraction(overview?: JobOverview | null): number {
  return clamp01(overview?.progress ?? 0);
}

/** Rounded 0..100 progress percentage for display. */
export function jobOverviewProgressPercent(overview?: JobOverview | null): number {
  return Math.round(jobOverviewProgressFraction(overview) * 100);
}

/** Compact attempt label, defensive for missing/malformed values. */
export function jobOverviewAttemptLabel(attempt?: number | null): string {
  return typeof attempt === "number" && Number.isFinite(attempt) && attempt >= 1
    ? `attempt ${Math.trunc(attempt)}`
    : "attempt ?";
}

/** Short, human-friendly label for a job UUID in a compact header. */
export function jobOverviewShortId(jobId?: string | null): string {
  if (!jobId) return "—";
  return jobId.length > 8 ? `${jobId.slice(0, 8)}…` : jobId;
}

/** Human label for a job terminal result, or "" when no result is recorded. */
export function jobOverviewResultLabel(result?: JobOverview["result"] | null): string {
  if (!result) return "";
  const assetCount = result.asset_ids?.length ?? 0;
  const text = result.text?.trim();
  if (text) {
    return assetCount > 0 ? `${text} · ${assetCount} asset${assetCount === 1 ? "" : "s"}` : text;
  }
  return assetCount > 0 ? `${assetCount} asset${assetCount === 1 ? "" : "s"}` : "";
}

/** Identity badges, progress, terminal signals and recency for the snapshot header. */
export function jobOverviewIdentity(
  overview?: JobOverview | null,
  now: number = Date.now(),
): JobOverviewIdentity {
  const status: JobStatus | undefined = overview?.status;
  const error = overview?.error;
  return {
    jobIdLabel: jobOverviewShortId(overview?.job_id),
    operationLabel: queueOperationLabel(overview?.operation_id ?? ""),
    projectLabel: overview?.project_name || "",
    statusLabel: status ? jobStatusLabel(status) : "Unknown",
    statusTone: status ? (jobStatusTone(status) ?? "neutral") : "neutral",
    attemptLabel: jobOverviewAttemptLabel(overview?.attempt),
    schemaLabel: overview?.schema_version || "—",
    progressPercent: jobOverviewProgressPercent(overview),
    progressFraction: jobOverviewProgressFraction(overview),
    errorLabel: error ? `${error.code}: ${error.message}`.trim() : "",
    resultLabel: jobOverviewResultLabel(overview?.result),
    createdLabel: jobOverviewRelativeLabel(overview?.created_at, now),
    startedLabel: jobOverviewRelativeLabel(overview?.started_at, now),
    finishedLabel: jobOverviewRelativeLabel(overview?.finished_at, now),
  };
}

/** The four headline job counters, in a stable display order. */
export function jobOverviewStatRows(overview?: JobOverview | null): JobOverviewStat[] {
  const identity = jobOverviewIdentity(overview);
  return [
    {
      key: "events",
      label: "Events",
      value: String(jobOverviewEventCount(overview)),
      hint: "Recorded job events",
    },
    {
      key: "retries",
      label: "Retries",
      value: String(jobOverviewRetryCount(overview)),
      hint: "Accepted retries",
    },
    {
      key: "status",
      label: "Status",
      value: identity.statusLabel,
      hint: "Current lifecycle state",
    },
    {
      key: "progress",
      label: "Progress",
      value: `${identity.progressPercent}%`,
      hint: identity.attemptLabel,
    },
  ];
}

/** Bridge the overview's event-type buckets into the canonical stats shape. */
function asEventStats(overview?: JobOverview | null): EventStats {
  return {
    total_events: jobOverviewEventCount(overview),
    total_jobs: overview ? 1 : 0,
    by_type: overview?.counts?.by_event_type,
    generated_at: overview?.generated_at ?? "",
  };
}

/** Zero-filled event-type distribution shared with the event-stats view. */
export function jobOverviewEventTypeRows(overview?: JobOverview | null): EventTypeRow[] {
  return eventTypeRows(asEventStats(overview));
}

/** Newest-first recent events projected into render-safe rows. */
export function jobOverviewRecentEvents(
  overview?: JobOverview | null,
  now: number = Date.now(),
): JobOverviewRecentEvent[] {
  const toneById = new Map(jobOverviewEventTypeRows(overview).map((row) => [row.type, row.tone]));
  return (overview?.recent_events ?? []).map((event: JobEvent) => {
    const status: JobStatus | null | undefined = event.status;
    return {
      id: `${event.job_id}:${event.seq}`,
      seq: Number.isFinite(event.seq) ? event.seq : 0,
      typeLabel: eventTypeLabel(event.type),
      typeTone: toneById.get(event.type) ?? "neutral",
      statusLabel: status ? jobStatusLabel(status) : "—",
      statusTone: status ? (jobStatusTone(status) ?? "neutral") : "neutral",
      message: event.message?.trim() || event.error?.message?.trim() || "—",
      progressPercent: clamp01(event.progress ?? 0) * 100,
      timestamp: event.timestamp,
      relativeTime: eventRelativeLabel(event.timestamp, now),
    };
  });
}

/** False only when the snapshot is missing or has no event/retry activity. */
export function hasJobOverviewData(overview?: JobOverview | null): boolean {
  if (!overview) return false;
  return (
    jobOverviewEventCount(overview) > 0 ||
    jobOverviewRetryCount(overview) > 0 ||
    (overview.recent_events?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function jobOverviewSummaryLabel(overview?: JobOverview | null): string {
  if (!overview) return "";
  const events = jobOverviewEventCount(overview);
  const retries = jobOverviewRetryCount(overview);
  return `${events} event${events === 1 ? "" : "s"} · ${retries} retr${retries === 1 ? "y" : "ies"}`;
}
