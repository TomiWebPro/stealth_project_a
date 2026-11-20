/**
 * Display models for the authoritative single-orchestration-run overview
 * (C242/C244/C245 follow-up). The backend derives the whole snapshot fresh from
 * the authoritative run/job/retry stores — the same stores `/orchestration/feed`
 * lists and `/orchestration/stats` aggregates — and the mocks transport mirrors
 * that derivation. This module only turns the canonical `RunOverview` payload
 * and the orchestration feed (used to populate the picker) into render-ready
 * values so `RunOverviewPanel` stays free of inline mapping and both transports
 * render identically.
 *
 * Every helper tolerates `undefined` (query not settled / failed / unknown run)
 * and returns render-safe, zero-filled values. Run-stage labels/tones, job-status
 * labels/tones, short ids and project-name fallbacks reuse the canonical
 * orchestration/job helpers so the overview cannot drift from the workspace-wide
 * orchestration, job-stats and job-overview screens.
 */

import type { RunOverviewOptions } from "../../lib/runOverview";
import type { OrchestrationFeedOptions } from "../../lib/orchestrationFeed";
import type {
  JobStatus,
  OrchestrationFeed,
  OrchestrationFeedItem,
  RunOverview,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { ALL_JOB_STATUSES, jobStatusLabel, jobStatusTone } from "./helpers";
import { humanizeOperationId } from "./jobStatsHelpers";
import {
  orchestrationFeedProjectName,
  orchestrationStageLabel,
  orchestrationStageTone,
  shortOrchestrationFeedId,
} from "./orchestrationFeedHelpers";

/** Page size used to populate the run picker from the authoritative feed. */
export const RUN_OVERVIEW_PICKER_LIMIT = 50;

/** Recent-projection chips offered above the overview. */
export const RUN_OVERVIEW_RECENT_LIMITS: readonly number[] = [5, 10, 25];

/** Hook options for the bounded recent-jobs projection. */
export function runOverviewOptions(recentLimit?: number): RunOverviewOptions {
  return recentLimit === undefined ? {} : { recentLimit };
}

/** Feed options used to populate the run picker, optionally project-scoped. */
export function buildRunPickerFeedOptions(projectId?: string): OrchestrationFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    kind: "run",
    limit: RUN_OVERVIEW_PICKER_LIMIT,
  };
}

/** A render-ready option for the run picker. */
export interface RunPickerOption {
  readonly value: string;
  readonly label: string;
}

/** Compact picker label for one run feed item. */
export function runOptionLabel(item: OrchestrationFeedItem): string {
  const stage = item.stage ? orchestrationStageLabel(item.stage) : "Run";
  return `Run · ${shortOrchestrationFeedId(item.run_id ?? item.id)} · ${orchestrationFeedProjectName(
    item.project_name,
  )} · ${stage}`;
}

/** Map the authoritative orchestration feed into deterministic run options. */
export function runPickerOptions(feed?: OrchestrationFeed): readonly RunPickerOption[] {
  return (feed?.items ?? [])
    .filter((item) => item.kind === "run" && Boolean(item.run_id ?? item.id))
    .map((item) => ({ value: item.run_id ?? item.id, label: runOptionLabel(item) }));
}

export interface RunOverviewIdentity {
  readonly runIdLabel: string;
  readonly planIdLabel: string;
  readonly projectName: string;
  readonly projectId: string;
  readonly planGoalLabel: string;
  readonly stageLabel: string;
  readonly stageTone: BadgeTone;
  readonly createdLabel: string;
}

export interface RunOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface RunOverviewStatusRow {
  readonly status: JobStatus;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all resolved jobs, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface RunOverviewJobRow {
  readonly id: string;
  readonly shortId: string;
  readonly operationLabel: string;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  /** Normalized job progress for a determinate bar, 0..1. */
  readonly progressFraction: number;
  readonly progressPercent: number;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Defensive non-negative count for a possibly malformed snapshot field. */
function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

/** Compact relative label for a timestamp, or "" when absent. */
export function runOverviewRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function runOverviewGeneratedAtLabel(
  overview?: RunOverview | null,
  now: number = Date.now(),
): string {
  return runOverviewRelativeLabel(overview?.generated_at, now);
}

/** Whole-scope counts, zero-filled for a missing snapshot. */
export function runOverviewCounts(overview?: RunOverview | null): {
  jobsLinked: number;
  jobsResolved: number;
  planSteps: number;
} {
  return {
    jobsLinked: nonNegativeCount(overview?.counts?.jobs_linked),
    jobsResolved: nonNegativeCount(overview?.counts?.jobs_resolved),
    planSteps: nonNegativeCount(overview?.counts?.plan_steps),
  };
}

/** Identity, joined plan/project context and lifecycle for the snapshot header. */
export function runOverviewIdentity(
  overview?: RunOverview | null,
  now: number = Date.now(),
): RunOverviewIdentity {
  const goal = typeof overview?.plan_goal === "string" ? overview.plan_goal.trim() : "";
  const stage = overview?.stage;
  return {
    runIdLabel: shortOrchestrationFeedId(overview?.run_id),
    planIdLabel: shortOrchestrationFeedId(overview?.plan_id),
    projectName: orchestrationFeedProjectName(overview?.project_name),
    projectId: overview?.project_id ?? "",
    planGoalLabel: goal || "No plan goal recorded",
    stageLabel: stage ? orchestrationStageLabel(stage) : "—",
    stageTone: stage ? orchestrationStageTone(stage) : "neutral",
    createdLabel: runOverviewRelativeLabel(overview?.created_at, now),
  };
}

/** Headline counters: whole-run totals plus the bounded recent projection. */
export function runOverviewStatRows(overview?: RunOverview | null): RunOverviewStat[] {
  const counts = runOverviewCounts(overview);
  return [
    {
      key: "plan-steps",
      label: "Plan steps",
      value: String(counts.planSteps),
      hint: "Parent plan steps",
    },
    {
      key: "jobs-linked",
      label: "Jobs linked",
      value: String(counts.jobsLinked),
      hint: "Referenced by the run",
    },
    {
      key: "jobs-resolved",
      label: "Jobs resolved",
      value: String(counts.jobsResolved),
      hint: "Found in the job store",
    },
    {
      key: "recent-jobs",
      label: "Recent jobs",
      value: String((overview?.recent_jobs ?? []).length),
      hint: "Shown (bounded)",
    },
  ];
}

/** Zero-filled queued/running/succeeded/failed/canceled status distribution. */
export function runOverviewStatusRows(overview?: RunOverview | null): RunOverviewStatusRow[] {
  const counts = new Map<string, number>();
  for (const entry of overview?.by_status ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.status, entry.count);
  }
  const total = ALL_JOB_STATUSES.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);
  return ALL_JOB_STATUSES.map((status) => {
    const count = counts.get(status) ?? 0;
    const fraction = total > 0 ? Math.min(1, Math.max(0, count / total)) : 0;
    return {
      status,
      label: jobStatusLabel(status),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: jobStatusTone(status),
    };
  });
}

/** Newest-first recent jobs, projected into render-ready rows (wire order kept). */
export function runOverviewJobRows(
  overview?: RunOverview | null,
  now: number = Date.now(),
): RunOverviewJobRow[] {
  return (overview?.recent_jobs ?? []).map((job) => {
    const status: JobStatus = job.status;
    const progress = typeof job.progress === "number" && Number.isFinite(job.progress) ? job.progress : 0;
    const progressFraction = Math.min(1, Math.max(0, progress));
    return {
      id: job.job_id,
      shortId: shortOrchestrationFeedId(job.job_id),
      operationLabel: humanizeOperationId(job.operation_id),
      statusLabel: status ? jobStatusLabel(status) : "—",
      statusTone: status ? jobStatusTone(status) : "neutral",
      progressFraction,
      progressPercent: Math.round(progressFraction * 100),
      timestamp: job.created_at,
      relativeTime: runOverviewRelativeLabel(job.created_at, now),
    };
  });
}

/** One-line summary for the panel header/footer. */
export function runOverviewSummaryLabel(overview?: RunOverview | null): string {
  if (!overview) return "";
  const identity = runOverviewIdentity(overview, 0);
  const counts = runOverviewCounts(overview);
  return `Run in ${identity.projectName} · ${identity.stageLabel} · ${counts.jobsResolved}/${counts.jobsLinked} jobs resolved`;
}

/** False only when the snapshot is missing or has no run activity. */
export function hasRunOverviewData(overview?: RunOverview | null): boolean {
  if (!overview) return false;
  const counts = runOverviewCounts(overview);
  return (
    counts.planSteps > 0 ||
    counts.jobsLinked > 0 ||
    counts.jobsResolved > 0 ||
    (overview.recent_jobs?.length ?? 0) > 0
  );
}
