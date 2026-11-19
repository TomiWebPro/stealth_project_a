/**
 * Display models for the authoritative job dispatch queue (C121/C123 follow-up).
 * Every value rendered by `JobQueuePanel` is derived here from the raw
 * `JobQueueView` so loading/empty/populated states stay consistent across mock
 * and live transports and JSX stays free of inline derivation.
 *
 * Helpers tolerate `undefined` views/entries (query not settled / error) and
 * return zero-filled, render-safe values. Entry order is preserved exactly as
 * the backend returns it (FIFO by `(created_at, job_id)` with 1-based positions),
 * so the UI never re-sorts the authoritative queue.
 */

import type { JobQueueEntry, JobQueueView, JobStatus } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative, jobStatusTone } from "../home/format";

/** Default and bounds for the bounded `limit` page mirrored from the router. */
export const QUEUE_DEFAULT_LIMIT = 25;
export const QUEUE_MIN_LIMIT = 1;
export const QUEUE_MAX_LIMIT = 200;

/** Page-size choices offered by the panel control. */
export const QUEUE_PAGE_SIZES: readonly number[] = [10, 25, 50, 100];

export interface JobQueueCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface JobQueueRow {
  readonly position: number;
  readonly positionLabel: string;
  readonly jobId: string;
  readonly jobLabel: string;
  readonly operationLabel: string;
  readonly status: JobStatus;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly projectId: string;
  readonly projectLabel: string;
  readonly queuedAtLabel: string;
  readonly isRunning: boolean;
}

const STATUS_LABELS: Readonly<Record<JobStatus, string>> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

function shortId(value: string): string {
  if (!value) return "—";
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Human label for a canonical job status. */
export function queueStatusLabel(status: JobStatus): string {
  return STATUS_LABELS[status] ?? "Job";
}

/** Badge tone for a canonical job status, shared with the other job views. */
export function queueStatusTone(status: JobStatus): BadgeTone {
  return jobStatusTone(status) ?? "neutral";
}

/** Prettify an operation id (`dataset-prep` → `Dataset prep`) for display. */
export function queueOperationLabel(operationId: string): string {
  if (!operationId) return "Unknown operation";
  return operationId
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Position badge label for a queued job (`#1`). */
export function queuePositionLabel(position: number): string {
  return Number.isFinite(position) && position > 0 ? `#${position}` : "—";
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function queueRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer). */
export function jobQueueGeneratedAtLabel(
  view?: JobQueueView,
  now: number = Date.now(),
): string {
  return queueRelativeLabel(view?.generated_at, now);
}

/** Rounded percentage of the whole queue currently running/waiting, 0..100. */
export function queueSharePercent(view?: JobQueueView, kind: "waiting" | "running" = "waiting"): number {
  const total = view?.total ?? 0;
  const count = kind === "running" ? (view?.running ?? 0) : (view?.waiting ?? 0);
  return Math.round(clamp01(total > 0 ? count / total : 0) * 100);
}

/**
 * Four summary cards describing the whole (unpaged) queue: active total,
 * waiting, running and a recency/throughput hint. `generated_at` fills the
 * recency value when present so the cards stay render-safe for every state.
 */
export function jobQueueCards(view?: JobQueueView, now: number = Date.now()): JobQueueCard[] {
  const total = view?.total ?? 0;
  const waiting = view?.waiting ?? 0;
  const running = view?.running ?? 0;
  const waitingPercent = queueSharePercent(view, "waiting");
  const runningPercent = queueSharePercent(view, "running");
  return [
    {
      key: "active",
      label: "Active jobs",
      value: String(total),
      hint: "Waiting + running",
    },
    {
      key: "waiting",
      label: "Waiting",
      value: String(waiting),
      hint: `${waitingPercent}% of queue`,
    },
    {
      key: "running",
      label: "Running",
      value: String(running),
      hint: `${runningPercent}% of queue`,
    },
    {
      key: "generated",
      label: "Snapshot",
      value: jobQueueGeneratedAtLabel(view, now) || "—",
      hint: "Generated at",
    },
  ];
}

/** Resolve a friendly project name, falling back to a short id. */
export function queueProjectLabel(
  projectId: string,
  projectNames?: Readonly<Record<string, string>>,
): string {
  if (!projectId) return "—";
  const name = projectNames?.[projectId];
  return name?.trim() ? name : shortId(projectId);
}

/** Derive one render-ready queue row from an authoritative entry. */
export function jobQueueRow(
  entry: JobQueueEntry,
  projectNames?: Readonly<Record<string, string>>,
  now: number = Date.now(),
): JobQueueRow {
  return {
    position: entry.position,
    positionLabel: queuePositionLabel(entry.position),
    jobId: entry.job_id,
    jobLabel: shortId(entry.job_id),
    operationLabel: queueOperationLabel(entry.operation_id),
    status: entry.status,
    statusLabel: queueStatusLabel(entry.status),
    statusTone: queueStatusTone(entry.status),
    projectId: entry.project_id,
    projectLabel: queueProjectLabel(entry.project_id, projectNames),
    queuedAtLabel: queueRelativeLabel(entry.created_at, now) || "—",
    isRunning: entry.status === "running",
  };
}

/**
 * Render-ready FIFO rows. Malformed entries are skipped defensively; the
 * backend/mocks always emit complete entries. Order is left untouched.
 */
export function jobQueueRows(
  view?: JobQueueView,
  projectNames?: Readonly<Record<string, string>>,
  now: number = Date.now(),
): JobQueueRow[] {
  return (view?.entries ?? [])
    .filter(
      (entry): entry is JobQueueEntry =>
        Boolean(entry) &&
        Number.isFinite(entry.position) &&
        typeof entry.job_id === "string" &&
        typeof entry.operation_id === "string" &&
        typeof entry.status === "string",
    )
    .map((entry) => jobQueueRow(entry, projectNames, now));
}

/** True when the snapshot carries at least one active job. */
export function hasJobQueueData(view?: JobQueueView): boolean {
  return (view?.total ?? 0) > 0 || (view?.entries?.length ?? 0) > 0;
}

/** Accessible label for the bounded page currently shown. */
export function jobQueuePageLabel(view?: JobQueueView, shown?: number): string {
  const total = view?.total ?? 0;
  const count = shown ?? (view?.entries?.length ?? 0);
  return `Showing ${count} of ${total} active ${total === 1 ? "job" : "jobs"}`;
}

/** Normalize a requested page size to the router's 1..200 bounds. */
export function queuePageSize(value: number): number {
  if (!Number.isFinite(value)) return QUEUE_DEFAULT_LIMIT;
  return Math.min(QUEUE_MAX_LIMIT, Math.max(QUEUE_MIN_LIMIT, Math.trunc(value)));
}
