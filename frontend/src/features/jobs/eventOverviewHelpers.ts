/**
 * Display models for the authoritative single job-event overview (C274/C276/C277
 * follow-up). Every value rendered by `EventOverviewPanel` is derived here from
 * the raw `EventOverview` snapshot so loading/error/missing/empty/populated
 * states stay consistent across mock and live transports and the JSX stays free
 * of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown event)
 * and return zero-filled, render-safe values. The zero-filled event-type
 * breakdown reuses the canonical `eventStatsHelpers` projection so the overview
 * can never drift from the workspace-wide event-stats view. The picker options
 * mirror the newest-first `useEventFeed` order, the authoritative source the
 * event feed renders.
 */

import type { EventOverviewOptions } from "../../lib/eventOverview";
import type {
  EventFeed,
  EventFeedItem,
  EventOverview,
  EventStats,
  JobEvent,
  JobEventType,
  JobStatus,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { eventJobLabel, eventTypeLabel, eventTypeRows, type EventTypeRow } from "./eventStatsHelpers";
import { eventFeedTone } from "./eventFeedHelpers";
import { jobStatusLabel, jobStatusTone } from "./helpers";
import { queueOperationLabel } from "./jobQueueHelpers";

/** Page bound used for the bounded sibling list (counts are never bounded). */
export const EVENT_OVERVIEW_RECENT_LIMIT = 5;

/** Page-size chips offered above the sibling list. */
export const EVENT_OVERVIEW_LIMITS: readonly number[] = [5, 10, 25];

/** Maximum feed rows used to build the picker (mirrors the feed's default page). */
export const EVENT_OVERVIEW_PICKER_LIMIT = 50;

function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

function shortId(value?: string | null, prefix = "Job"): string {
  if (!value) return "";
  return value.length > 8 ? `${prefix} ${value.slice(0, 8)}…` : value;
}

export interface EventOverviewIdentity {
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly jobLabel: string;
  readonly seqLabel: string;
  readonly operationLabel: string;
  readonly projectLabel: string;
  readonly messagePreview: string;
  readonly errorLabel: string;
  readonly emittedLabel: string;
  readonly progressPercent: number | null;
}

export interface EventOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface EventOverviewSibling {
  readonly id: string;
  readonly seq: number;
  readonly seqLabel: string;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly messagePreview: string;
  readonly progressPercent: number | null;
  readonly timestamp: string;
  readonly relativeTime: string;
  readonly isCurrent: boolean;
}

export interface EventOverviewPickerOption {
  readonly value: string;
  readonly label: string;
  readonly jobId: string;
  readonly seq: number;
}

/** Hook query options for the bounded sibling page. */
export function buildEventOverviewOptions(
  recentLimit: number = EVENT_OVERVIEW_RECENT_LIMIT,
): EventOverviewOptions {
  return { recentLimit };
}

/** Whole-job event total, zero-filled when the snapshot is absent. */
export function eventOverviewCount(overview?: EventOverview | null): number {
  return nonNegativeCount(overview?.counts?.total);
}

/** Short relative label for a timestamp, or "" when absent. */
export function eventOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function eventOverviewGeneratedAtLabel(
  overview?: EventOverview | null,
  now: number = Date.now(),
): string {
  return eventOverviewRelativeLabel(overview?.generated_at, now);
}

/** Whitespace-normalized, truncated single-line preview of an event payload. */
export function eventOverviewMessagePreview(
  event?: Pick<JobEvent, "message" | "error"> | null,
  max = 140,
): string {
  const raw =
    typeof event?.message === "string" && event.message.trim()
      ? event.message
      : event?.error && typeof event.error.message === "string"
        ? event.error.message
        : "";
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return "No message";
  return normalized.length > max ? `${normalized.slice(0, max).trimEnd()}…` : normalized;
}

/** Human label for an event lifecycle status, tolerant of an unexpected wire value. */
export function eventOverviewStatusLabel(status?: JobStatus | null): string {
  return status ? jobStatusLabel(status) : "—";
}

/** Badge tone for an event lifecycle status. */
export function eventOverviewStatusTone(status?: JobStatus | null): BadgeTone {
  return status ? jobStatusTone(status) : "neutral";
}

/** Badge tone for a canonical job event type, reusing the feed's convention. */
export function eventOverviewTypeTone(type: JobEventType): BadgeTone {
  return eventFeedTone(type);
}

/** 1-based event sequence label for the selected event. */
export function eventOverviewSeqLabel(seq?: number | null): string {
  return typeof seq === "number" && Number.isFinite(seq) && seq >= 0 ? `#${Math.trunc(seq)}` : "—";
}

/** Defensive 0..100 percent for an event's optional 0..1 progress value. */
export function eventOverviewProgressPercent(progress?: number | null): number | null {
  if (typeof progress !== "number" || !Number.isFinite(progress)) return null;
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

/** Identity badges, payload preview and recency for the snapshot header. */
export function eventOverviewIdentity(
  overview?: EventOverview | null,
  now: number = Date.now(),
): EventOverviewIdentity {
  const type: JobEventType | undefined = overview?.type;
  return {
    typeLabel: type ? eventTypeLabel(type) : "Event",
    typeTone: type ? eventOverviewTypeTone(type) : "neutral",
    statusLabel: eventOverviewStatusLabel(overview?.status),
    statusTone: eventOverviewStatusTone(overview?.status),
    jobLabel: shortId(overview?.job_id, "Job"),
    seqLabel: eventOverviewSeqLabel(overview?.seq),
    operationLabel: queueOperationLabel(overview?.operation_id ?? ""),
    projectLabel: overview?.project_name || "",
    messagePreview: eventOverviewMessagePreview(overview),
    errorLabel: overview?.error?.message?.replace(/\s+/g, " ").trim() || "",
    emittedLabel: eventOverviewRelativeLabel(overview?.timestamp, now),
    progressPercent: eventOverviewProgressPercent(overview?.progress),
  };
}

/** The four headline event counters, in a stable display order. */
export function eventOverviewStatRows(
  overview?: EventOverview | null,
  now: number = Date.now(),
): EventOverviewStat[] {
  const identity = eventOverviewIdentity(overview, now);
  return [
    {
      key: "events",
      label: "Job events",
      value: String(eventOverviewCount(overview)),
      hint: "In the parent job",
    },
    {
      key: "sequence",
      label: "Sequence",
      value: identity.seqLabel,
      hint: "Selected event",
    },
    {
      key: "type",
      label: "Type",
      value: identity.typeLabel,
      hint: "Event kind",
    },
    {
      key: "emitted",
      label: "Emitted",
      value: identity.emittedLabel || "—",
      hint: "Event created",
    },
  ];
}

/** Bridge the overview counts into the canonical stats shape for reuse. */
function asEventStats(overview?: EventOverview | null): EventStats {
  return {
    total_events: eventOverviewCount(overview),
    total_jobs: overview ? 1 : 0,
    by_type: overview?.counts?.by_type,
    generated_at: overview?.generated_at ?? "",
  };
}

/** Zero-filled whole-job event-type distribution shared with the stats view. */
export function eventOverviewTypeRows(overview?: EventOverview | null): EventTypeRow[] {
  return eventTypeRows(asEventStats(overview));
}

/** Newest-first sibling events projected into render-safe rows. */
export function eventOverviewRecentSiblings(
  overview?: EventOverview | null,
  now: number = Date.now(),
): EventOverviewSibling[] {
  return (overview?.recent_siblings ?? []).map((event: JobEvent) => {
    const status: JobStatus | null | undefined = event.status;
    return {
      id: `${event.job_id}:${event.seq}`,
      seq: Number.isFinite(event.seq) ? Math.trunc(event.seq) : 0,
      seqLabel: eventOverviewSeqLabel(event.seq),
      typeLabel: eventTypeLabel(event.type),
      typeTone: eventOverviewTypeTone(event.type),
      statusLabel: eventOverviewStatusLabel(status),
      statusTone: eventOverviewStatusTone(status),
      messagePreview: eventOverviewMessagePreview(event),
      progressPercent: eventOverviewProgressPercent(event.progress),
      timestamp: event.timestamp,
      relativeTime: eventOverviewRelativeLabel(event.timestamp, now),
      isCurrent: event.seq === overview?.seq && event.job_id === overview?.job_id,
    };
  });
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasEventOverviewData(overview?: EventOverview | null): boolean {
  if (!overview) return false;
  return eventOverviewCount(overview) > 0 || (overview.recent_siblings?.length ?? 0) > 0;
}

/** One-line summary for the panel header/footer. */
export function eventOverviewSummaryLabel(overview?: EventOverview | null): string {
  if (!overview) return "";
  const total = eventOverviewCount(overview);
  return `${total} event${total === 1 ? "" : "s"} · selected ${eventOverviewSeqLabel(overview.seq)}`;
}

/** Scope-aware empty-state copy for the event picker. */
export function eventOverviewEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Events emitted by jobs in this project will appear here."
    : "Job events will appear here as work is submitted to the studio.";
}

/**
 * Picker options derived from the authoritative event feed. Each option is a
 * `(job_id, seq)` pair — the exact key the overview endpoint resolves — and the
 * label previews the event type and sequence so it agrees with the snapshot.
 */
export function eventOverviewPickerOptions(
  feed: EventFeed | undefined,
): EventOverviewPickerOption[] {
  return (feed?.items ?? []).map((item: EventFeedItem) => {
    const jobId = item.job_id;
    const seq = Number.isFinite(item.seq) ? Math.trunc(item.seq) : 0;
    return {
      value: `${jobId}:${seq}`,
      label: `${eventJobLabel(jobId)} · seq ${eventOverviewSeqLabel(seq)} · ${eventTypeLabel(item.type)}`,
      jobId,
      seq,
    };
  });
}

/** Resolve the active picker option, falling back to the first available row. */
export function eventOverviewActiveOption(
  options: readonly EventOverviewPickerOption[],
  selectedValue: string,
): EventOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}
