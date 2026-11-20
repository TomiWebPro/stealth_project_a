/**
 * Display models for the authoritative single retried-job overview
 * (C286/C288/C289 follow-up). Every value rendered by `RetryOverviewPanel` is
 * derived here from the raw `RetryOverview` snapshot so loading/error/missing/
 * empty/populated states stay consistent across mock and live transports and
 * the JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown job or
 * a job without accepted retries) and return zero-filled, render-safe values.
 * Counts and labels reuse the canonical retry feed/stats and job-status helpers
 * so the overview can never drift from the workspace-wide retry views. The
 * picker options mirror the newest-first `useRetryFeed` order, the authoritative
 * source the retry feed renders.
 */

import type { RetryOverviewOptions } from "../../lib/retryOverview";
import type {
  JobStatus,
  RetryFeed,
  RetryFeedItem,
  RetryOverview,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { jobStatusLabel, jobStatusTone } from "./helpers";
import { retryAttemptLabel, retryCountLabel } from "./retryFeedHelpers";
import { eventJobLabel } from "./eventStatsHelpers";
import { queueOperationLabel } from "./jobQueueHelpers";

/** Page bound used for the bounded sibling list (counts are never bounded). */
export const RETRY_OVERVIEW_RECENT_LIMIT = 5;

/** Page-size chips offered above the sibling list. */
export const RETRY_OVERVIEW_LIMITS: readonly number[] = [5, 10, 25];

/** Maximum feed rows used to build the picker (mirrors the feed's default page). */
export const RETRY_OVERVIEW_PICKER_LIMIT = 50;

function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

export interface RetryOverviewIdentity {
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly jobLabel: string;
  readonly operationLabel: string;
  readonly projectLabel: string;
  readonly attemptLabel: string;
  readonly retriesLabel: string;
  readonly retriedLabel: string;
}

export interface RetryOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface RetryOverviewSibling {
  readonly id: string;
  readonly jobLabel: string;
  readonly operationLabel: string;
  readonly projectLabel: string;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly attemptLabel: string;
  readonly retriesLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
  readonly isCurrent: boolean;
}

export interface RetryOverviewPickerOption {
  readonly value: string;
  readonly label: string;
  readonly jobId: string;
}

/** Hook query options for the bounded sibling page. */
export function buildRetryOverviewOptions(
  recentLimit: number = RETRY_OVERVIEW_RECENT_LIMIT,
): RetryOverviewOptions {
  return { recentLimit };
}

/** Counts of accepted retries for the whole workspace, zero-filled. */
export function retryOverviewTotalRetries(overview?: RetryOverview | null): number {
  return nonNegativeCount(overview?.counts?.total_retries);
}

/** Counts of accepted retries for the selected job's project, zero-filled. */
export function retryOverviewProjectRetries(overview?: RetryOverview | null): number {
  return nonNegativeCount(overview?.counts?.project_retries);
}

/** Counts of distinct retried jobs in the selected job's project, zero-filled. */
export function retryOverviewProjectJobs(overview?: RetryOverview | null): number {
  return nonNegativeCount(overview?.counts?.project_jobs);
}

/** Accepted retries for the selected job itself, zero-filled. */
export function retryOverviewJobRetries(overview?: RetryOverview | null): number {
  return nonNegativeCount(overview?.retries);
}

/** Short relative label for a timestamp, or "" when absent. */
export function retryOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function retryOverviewGeneratedAtLabel(
  overview?: RetryOverview | null,
  now: number = Date.now(),
): string {
  return retryOverviewRelativeLabel(overview?.generated_at, now);
}

/** Human label for a retried job's lifecycle status, tolerant of an unexpected wire value. */
export function retryOverviewStatusLabel(status?: JobStatus | null): string {
  return status ? jobStatusLabel(status) : "—";
}

/** Badge tone for a retried job's lifecycle status. */
export function retryOverviewStatusTone(status?: JobStatus | null): BadgeTone {
  return status ? (jobStatusTone(status) ?? "neutral") : "neutral";
}

/** Identity badges, attempt/retry labels and recency for the snapshot header. */
export function retryOverviewIdentity(
  overview?: RetryOverview | null,
  now: number = Date.now(),
): RetryOverviewIdentity {
  const status: JobStatus | null | undefined = overview?.status;
  return {
    statusLabel: retryOverviewStatusLabel(status),
    statusTone: retryOverviewStatusTone(status),
    jobLabel: eventJobLabel(overview?.job_id ?? ""),
    operationLabel: queueOperationLabel(overview?.operation_id ?? ""),
    projectLabel: overview?.project_name || "",
    attemptLabel: retryAttemptLabel(nonNegativeCount(overview?.attempt)),
    retriesLabel: retryCountLabel(retryOverviewJobRetries(overview)),
    retriedLabel: retryOverviewRelativeLabel(overview?.retried_at, now),
  };
}

/** The four headline retry counters, in a stable display order. */
export function retryOverviewStatRows(overview?: RetryOverview | null): RetryOverviewStat[] {
  return [
    {
      key: "workspace",
      label: "Workspace retries",
      value: String(retryOverviewTotalRetries(overview)),
      hint: "Accepted retries overall",
    },
    {
      key: "project",
      label: "Project retries",
      value: String(retryOverviewProjectRetries(overview)),
      hint: "In this job's project",
    },
    {
      key: "jobs",
      label: "Project retried jobs",
      value: String(retryOverviewProjectJobs(overview)),
      hint: "Distinct jobs retried",
    },
    {
      key: "selected",
      label: "This job",
      value: String(retryOverviewJobRetries(overview)),
      hint: "Accepted retries on the selected job",
    },
  ];
}

/** Newest-first same-project sibling retries projected into render-safe rows. */
export function retryOverviewRecentSiblings(
  overview?: RetryOverview | null,
  now: number = Date.now(),
): RetryOverviewSibling[] {
  return (overview?.recent_siblings ?? []).map((item: RetryFeedItem) => {
    const status: JobStatus | null | undefined = item.status;
    return {
      id: item.job_id,
      jobLabel: eventJobLabel(item.job_id),
      operationLabel: queueOperationLabel(item.operation_id),
      projectLabel: item.project_name,
      statusLabel: retryOverviewStatusLabel(status),
      statusTone: retryOverviewStatusTone(status),
      attemptLabel: retryAttemptLabel(item.attempt),
      retriesLabel: retryCountLabel(item.retries),
      timestamp: item.retried_at,
      relativeTime: retryOverviewRelativeLabel(item.retried_at, now),
      isCurrent: item.job_id === overview?.job_id,
    };
  });
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasRetryOverviewData(overview?: RetryOverview | null): boolean {
  if (!overview) return false;
  return retryOverviewTotalRetries(overview) > 0 || (overview.recent_siblings?.length ?? 0) > 0;
}

/** One-line summary for the panel header/footer. */
export function retryOverviewSummaryLabel(overview?: RetryOverview | null): string {
  if (!overview) return "";
  const identity = retryOverviewIdentity(overview);
  return `${identity.retriesLabel} · ${identity.attemptLabel}`;
}

/** Scope-aware empty-state copy for the retry picker. */
export function retryOverviewEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Retries of jobs in this project will appear here."
    : "Retried jobs will appear here after a failed job is retried.";
}

/**
 * Picker options derived from the authoritative retry feed. Each option's value
 * is the job id — the exact key the overview endpoint resolves — and the label
 * previews the operation and project so it agrees with the snapshot.
 */
export function retryOverviewPickerOptions(
  feed: RetryFeed | undefined,
): RetryOverviewPickerOption[] {
  return (feed?.items ?? []).map((item: RetryFeedItem) => ({
    value: item.job_id,
    label: `${eventJobLabel(item.job_id)} · ${queueOperationLabel(item.operation_id)} · ${item.project_name}`,
    jobId: item.job_id,
  }));
}

/** Resolve the active picker option, falling back to the first available row. */
export function retryOverviewActiveOption(
  options: readonly RetryOverviewPickerOption[],
  selectedValue: string,
): RetryOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}
