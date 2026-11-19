/**
 * Display models for the authoritative job feed (C141/C143/C144 follow-up).
 *
 * The backend derives the newest-first, workspace-wide feed fresh from the
 * authoritative `JOBS` collection — the same store `/jobs`, `/jobs/stats` and
 * `/jobs/queue` read — and the mocks transport mirrors that derivation. This
 * module only turns the canonical `JobFeed` payload into render-ready rows so
 * the panel JSX stays free of inline mapping and both transports render
 * identically. Every helper tolerates `undefined` (query not settled or failed)
 * and returns render-safe values.
 */

import type { JobFeedOptions } from "../../lib/jobFeed";
import type { JobFeed, JobFeedItem, JobStatus } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { jobStatusLabel, jobStatusTone } from "./helpers";
import { queueOperationLabel } from "./jobQueueHelpers";

/** Render-ready row for one job in the feed. */
export interface JobFeedRow {
  readonly id: string;
  readonly jobId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly operationId: string;
  readonly operationLabel: string;
  readonly status: JobStatus;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly progressPercent: number;
  readonly attemptLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const JOB_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Status chips offered above the feed; `undefined` means "all statuses". */
export const JOB_FEED_STATUS_FILTERS: readonly (JobStatus | undefined)[] = [
  undefined,
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
];

/** Hook query options from the active project/status scope and page size. */
export function buildJobFeedOptions(
  projectId: string | undefined,
  status: JobStatus | undefined,
  limit: number,
): JobFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    ...(status ? { status } : {}),
    limit,
  };
}

/** Human label for a status chip (`undefined` is the unfiltered "All" chip). */
export function jobFeedStatusChipLabel(status: JobStatus | undefined): string {
  return status ? jobStatusLabel(status) : "All";
}

/** Defensive 0..100 percent for a job's 0..1 progress value. */
export function jobFeedProgressPercent(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

/** Compact attempt label, defensive for malformed values. */
export function jobFeedAttemptLabel(attempt: number): string {
  return Number.isFinite(attempt) && attempt >= 1
    ? `attempt ${Math.trunc(attempt)}`
    : "attempt ?";
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by `(created_at, job_id)`).
 */
export function jobFeedRows(
  feed: JobFeed | undefined,
  now: number = Date.now(),
): readonly JobFeedRow[] {
  const items: readonly JobFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: item.job_id,
    jobId: item.job_id,
    projectId: item.project_id,
    projectName: item.project_name,
    operationId: item.operation_id,
    operationLabel: queueOperationLabel(item.operation_id),
    status: item.status,
    statusLabel: jobStatusLabel(item.status),
    statusTone: jobStatusTone(item.status),
    progressPercent: jobFeedProgressPercent(item.progress),
    attemptLabel: jobFeedAttemptLabel(item.attempt),
    timestamp: item.created_at,
    relativeTime: formatRelative(item.created_at, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all jobs in scope before the `limit` page is applied.
 */
export function jobFeedSummary(rows: readonly JobFeedRow[], total?: number): string {
  if (rows.length === 0) return "No jobs";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} job${count === 1 ? "" : "s"} · latest: ${latest?.operationLabel ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function jobFeedGeneratedAtLabel(
  feed: JobFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope- and filter-aware empty-state copy for the feed. */
export function jobFeedEmptyDescription(projectScoped: boolean, statusFiltered: boolean): string {
  if (statusFiltered) {
    return "No jobs match this status filter. Try a different status or clear it.";
  }
  return projectScoped
    ? "Jobs submitted in this project will appear here."
    : "Jobs will appear here as work is submitted to the studio.";
}
