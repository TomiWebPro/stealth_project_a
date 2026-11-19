/**
 * Display models for the authoritative job retry feed (C193/C195/C196 follow-up).
 *
 * The backend derives a newest-first, workspace-wide feed of retried jobs fresh
 * from the authoritative retry ledger joined to jobs and projects — the same
 * stores `/retries/stats` aggregates — and the mocks transport mirrors that
 * derivation. This module only turns the canonical `RetryFeed` payload into
 * render-ready rows so the panel JSX stays free of inline mapping and both
 * transports render identically. Every helper tolerates `undefined` (query not
 * settled or failed) and returns render-safe values.
 */

import type { RetryFeedOptions } from "../../lib/retryFeed";
import type { JobStatus, RetryFeed, RetryFeedItem } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { jobStatusLabel, jobStatusTone } from "./helpers";
import { eventJobLabel } from "./eventStatsHelpers";
import { queueOperationLabel } from "./jobQueueHelpers";

/** Render-ready row for one retried job in the feed. */
export interface RetryFeedRow {
  /** Stable React key: the ledger collapses replays to one row per retried job. */
  readonly id: string;
  readonly jobId: string;
  readonly jobLabel: string;
  readonly operationId: string;
  readonly operationLabel: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly status: JobStatus;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly attempt: number;
  readonly attemptLabel: string;
  readonly retries: number;
  readonly retriesLabel: string;
  readonly retriedAt: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const RETRY_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Hook query options from the active project scope and page size. */
export function buildRetryFeedOptions(
  projectId: string | undefined,
  limit: number,
): RetryFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    limit,
  };
}

/** Human label for a job's current attempt number. */
export function retryAttemptLabel(attempt: number): string {
  return Number.isFinite(attempt) && attempt > 0 ? `Attempt ${attempt}` : "Attempt —";
}

/** Human label for the accepted-retry count on a job. */
export function retryCountLabel(retries: number): string {
  const count = Number.isFinite(retries) && retries > 0 ? retries : 0;
  return `${count} ${count === 1 ? "retry" : "retries"}`;
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by `(retried_at, job_id)`).
 */
export function retryFeedRows(
  feed: RetryFeed | undefined,
  now: number = Date.now(),
): readonly RetryFeedRow[] {
  const items: readonly RetryFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: item.job_id,
    jobId: item.job_id,
    jobLabel: eventJobLabel(item.job_id),
    operationId: item.operation_id,
    operationLabel: queueOperationLabel(item.operation_id),
    projectId: item.project_id,
    projectName: item.project_name,
    status: item.status,
    statusLabel: jobStatusLabel(item.status),
    statusTone: jobStatusTone(item.status) ?? "neutral",
    attempt: item.attempt,
    attemptLabel: retryAttemptLabel(item.attempt),
    retries: item.retries,
    retriesLabel: retryCountLabel(item.retries),
    retriedAt: item.retried_at,
    relativeTime: formatRelative(item.retried_at, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all retried jobs in scope before the `limit` page is applied.
 */
export function retryFeedSummary(rows: readonly RetryFeedRow[], total?: number): string {
  if (rows.length === 0) return "No retries";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${retryCountLabel(count)} · latest: ${latest?.operationLabel ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function retryFeedGeneratedAtLabel(
  feed: RetryFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope-aware empty-state copy for the feed. */
export function retryFeedEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Retries of jobs in this project will appear here."
    : "Retried jobs will appear here after a failed job is retried.";
}
