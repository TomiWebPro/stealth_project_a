/**
 * Display models for the authoritative job event feed (C169/C171/C172 follow-up).
 *
 * The backend derives the newest-first, workspace-wide feed fresh from the
 * authoritative `JOB_EVENTS` stream — the same store `/events/stats` aggregates
 * and the SSE/polling endpoints read — and the mocks transport mirrors that
 * derivation. This module only turns the canonical `EventFeed` payload into
 * render-ready rows so the panel JSX stays free of inline mapping and both
 * transports render identically. Every helper tolerates `undefined` (query not
 * settled or failed) and returns render-safe values.
 */

import type { EventFeedOptions } from "../../lib/eventFeed";
import type { EventFeed, EventFeedItem, JobEventType } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { jobStatusLabel, jobStatusTone } from "./helpers";
import { eventJobLabel, eventTypeLabel } from "./eventStatsHelpers";
import { queueOperationLabel } from "./jobQueueHelpers";

/** Render-ready row for one event in the feed. */
export interface EventFeedRow {
  /** Stable React key: a job may emit several events with distinct sequence numbers. */
  readonly id: string;
  readonly jobId: string;
  readonly jobLabel: string;
  readonly seq: number;
  readonly type: JobEventType;
  readonly typeLabel: string;
  readonly tone: BadgeTone;
  readonly operationId: string;
  readonly operationLabel: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone | undefined;
  /** 0..100 for a finite 0..1 progress signal, `null` when the event has none. */
  readonly progressPercent: number | null;
  /** Whitespace-normalized/truncated message (or error message), `""` when absent. */
  readonly message: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const EVENT_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Event-type chips offered above the feed; `undefined` means "all types". */
export const EVENT_FEED_TYPE_FILTERS: readonly (JobEventType | undefined)[] = [
  undefined,
  "status",
  "progress",
  "intermediate",
  "result",
  "error",
  "log",
];

const EVENT_TYPE_TONES: Readonly<Record<JobEventType, BadgeTone>> = {
  status: "info",
  progress: "accent",
  intermediate: "accent",
  result: "success",
  error: "danger",
  log: "neutral",
};

/** Hook query options from the active project/type scope and page size. */
export function buildEventFeedOptions(
  projectId: string | undefined,
  type: JobEventType | undefined,
  limit: number,
): EventFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    ...(type ? { type } : {}),
    limit,
  };
}

/** Human label for an event-type chip (`undefined` is the unfiltered "All" chip). */
export function eventFeedTypeChipLabel(type: JobEventType | undefined): string {
  return type ? eventTypeLabel(type) : "All";
}

/** Badge tone for a canonical job event type. */
export function eventFeedTone(type: JobEventType): BadgeTone {
  return EVENT_TYPE_TONES[type] ?? "neutral";
}

/** Defensive 0..100 percent for an event's optional 0..1 progress value. */
export function eventFeedProgressPercent(progress: number | null | undefined): number | null {
  if (typeof progress !== "number" || !Number.isFinite(progress)) return null;
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

/** Whitespace-normalized message used in compact feed rows. */
export function eventFeedMessage(item: EventFeedItem): string {
  const message = typeof item.message === "string" ? item.message : "";
  if (message.trim()) return message.replace(/\s+/g, " ").trim();
  const error = item.error;
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.replace(/\s+/g, " ").trim();
  }
  return "";
}

/** Truncate a normalized message for a one-line row preview. */
export function eventFeedMessageExcerpt(item: EventFeedItem, max = 120): string {
  const message = eventFeedMessage(item);
  if (message.length <= max) return message;
  return `${message.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by `(timestamp, job_id, seq)`).
 */
export function eventFeedRows(
  feed: EventFeed | undefined,
  now: number = Date.now(),
): readonly EventFeedRow[] {
  const items: readonly EventFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: `${item.job_id}:${item.seq}`,
    jobId: item.job_id,
    jobLabel: eventJobLabel(item.job_id),
    seq: item.seq,
    type: item.type,
    typeLabel: eventTypeLabel(item.type),
    tone: eventFeedTone(item.type),
    operationId: item.operation_id,
    operationLabel: queueOperationLabel(item.operation_id),
    projectId: item.project_id,
    projectName: item.project_name,
    statusLabel: item.status ? jobStatusLabel(item.status) : "",
    statusTone: item.status ? jobStatusTone(item.status) : undefined,
    progressPercent: eventFeedProgressPercent(item.progress),
    message: eventFeedMessageExcerpt(item),
    timestamp: item.timestamp,
    relativeTime: formatRelative(item.timestamp, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all events in scope before the `limit` page is applied.
 */
export function eventFeedSummary(rows: readonly EventFeedRow[], total?: number): string {
  if (rows.length === 0) return "No events";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} event${count === 1 ? "" : "s"} · latest: ${latest?.typeLabel ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function eventFeedGeneratedAtLabel(
  feed: EventFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope- and filter-aware empty-state copy for the feed. */
export function eventFeedEmptyDescription(projectScoped: boolean, typeFiltered: boolean): string {
  if (typeFiltered) {
    return "No events match this type filter. Try a different type or clear it.";
  }
  return projectScoped
    ? "Events emitted by jobs in this project will appear here."
    : "Job events will appear here as work is submitted to the studio.";
}
