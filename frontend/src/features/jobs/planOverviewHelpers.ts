/**
 * Display models for the authoritative single-orchestration-plan overview
 * (C238/C240/C241 follow-up). The backend derives the whole snapshot fresh from
 * the authoritative plan/run stores — the same stores `/orchestration/feed`
 * lists and `/orchestration/stats` aggregates — and the mocks transport mirrors
 * that derivation. This module only turns the canonical `PlanOverview` payload
 * and the orchestration feed (used to populate the picker) into render-ready
 * values so `PlanOverviewPanel` stays free of inline mapping and both transports
 * render identically.
 *
 * Every helper tolerates `undefined` (query not settled / failed / unknown plan)
 * and returns render-safe, zero-filled values. Stage labels/tones, short ids and
 * project-name fallbacks reuse the canonical orchestration feed helpers so the
 * overview cannot drift from the workspace-wide orchestration screens.
 */

import type { OrchestrationFeedOptions } from "../../lib/orchestrationFeed";
import type { PlanOverviewOptions } from "../../lib/planOverview";
import type {
  OrchestrationFeed,
  OrchestrationFeedItem,
  OrchestrationStage,
  PlanOverview,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import {
  orchestrationFeedProjectName,
  orchestrationStageLabel,
  orchestrationStageTone,
  shortOrchestrationFeedId,
} from "./orchestrationFeedHelpers";

/** Page size used to populate the plan picker from the authoritative feed. */
export const PLAN_OVERVIEW_PICKER_LIMIT = 50;

/** Recent-projection chips offered above the overview. */
export const PLAN_OVERVIEW_RECENT_LIMITS: readonly number[] = [5, 10, 25];

/** Canonical lifecycle order, mirroring `ORCHESTRATION_STAGES` in lib. */
const PLAN_STAGE_ORDER: readonly OrchestrationStage[] = [
  "plan",
  "resolve",
  "submit",
  "await",
  "collect",
  "done",
];

/** Hook options for the bounded recent-runs projection. */
export function planOverviewOptions(recentLimit?: number): PlanOverviewOptions {
  return recentLimit === undefined ? {} : { recentLimit };
}

/** Feed options used to populate the plan picker, optionally project-scoped. */
export function buildPlanPickerFeedOptions(projectId?: string): OrchestrationFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    kind: "plan",
    limit: PLAN_OVERVIEW_PICKER_LIMIT,
  };
}

/** A render-ready option for the plan picker. */
export interface PlanPickerOption {
  readonly value: string;
  readonly label: string;
}

/** Compact picker label for one plan feed item. */
export function planOptionLabel(item: OrchestrationFeedItem): string {
  const goal = typeof item.goal === "string" ? item.goal.trim() : "";
  return `Plan · ${shortOrchestrationFeedId(item.plan_id)} · ${orchestrationFeedProjectName(item.project_name)}${
    goal ? ` · ${goal}` : ""
  }`;
}

/** Map the authoritative orchestration feed into deterministic plan options. */
export function planPickerOptions(feed?: OrchestrationFeed): readonly PlanPickerOption[] {
  return (feed?.items ?? [])
    .filter((item) => item.kind === "plan" && Boolean(item.plan_id))
    .map((item) => ({ value: item.plan_id, label: planOptionLabel(item) }));
}

export interface PlanOverviewIdentity {
  readonly planIdLabel: string;
  readonly projectName: string;
  readonly projectId: string;
  readonly goalLabel: string;
  readonly createdLabel: string;
}

export interface PlanOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface PlanOverviewStageRow {
  readonly stage: OrchestrationStage;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all scoped runs, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface PlanRunRow {
  readonly id: string;
  readonly shortId: string;
  readonly stageLabel: string;
  readonly stageTone: BadgeTone;
  readonly jobCount: number;
  readonly jobCountLabel: string;
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
export function planOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function planOverviewGeneratedAtLabel(
  overview?: PlanOverview | null,
  now: number = Date.now(),
): string {
  return planOverviewRelativeLabel(overview?.generated_at, now);
}

/** Whole-scope counts, zero-filled for a missing snapshot. */
export function planOverviewCounts(overview?: PlanOverview | null): {
  steps: number;
  runs: number;
  jobsLinked: number;
} {
  return {
    steps: nonNegativeCount(overview?.counts?.steps),
    runs: nonNegativeCount(overview?.counts?.runs),
    jobsLinked: nonNegativeCount(overview?.counts?.jobs_linked),
  };
}

/** Identity, goal and project attribution for the snapshot header. */
export function planOverviewIdentity(
  overview?: PlanOverview | null,
  now: number = Date.now(),
): PlanOverviewIdentity {
  const goal = typeof overview?.goal === "string" ? overview.goal.trim() : "";
  return {
    planIdLabel: shortOrchestrationFeedId(overview?.plan_id),
    projectName: orchestrationFeedProjectName(overview?.project_name),
    projectId: overview?.project_id ?? "",
    goalLabel: goal || "No goal recorded",
    createdLabel: planOverviewRelativeLabel(overview?.created_at, now),
  };
}

/** Headline counters: whole-plan totals plus the bounded recent projection. */
export function planOverviewStatRows(overview?: PlanOverview | null): PlanOverviewStat[] {
  const counts = planOverviewCounts(overview);
  return [
    {
      key: "steps",
      label: "Plan steps",
      value: String(counts.steps),
      hint: "Whole-plan step total",
    },
    {
      key: "runs",
      label: "Runs",
      value: String(counts.runs),
      hint: "Whole-plan run total",
    },
    {
      key: "jobs-linked",
      label: "Jobs linked",
      value: String(counts.jobsLinked),
      hint: "Referenced by runs",
    },
    {
      key: "recent-runs",
      label: "Recent runs",
      value: String((overview?.recent_runs ?? []).length),
      hint: "Shown (bounded)",
    },
  ];
}

/** Zero-filled plan/resolve/submit/await/collect/done stage distribution. */
export function planOverviewStageRows(overview?: PlanOverview | null): PlanOverviewStageRow[] {
  const counts = new Map<string, number>();
  for (const entry of overview?.by_stage ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.stage, entry.count);
  }
  const total = PLAN_STAGE_ORDER.reduce((sum, stage) => sum + (counts.get(stage) ?? 0), 0);
  return PLAN_STAGE_ORDER.map((stage) => {
    const count = counts.get(stage) ?? 0;
    const fraction = total > 0 ? Math.min(1, Math.max(0, count / total)) : 0;
    return {
      stage,
      label: orchestrationStageLabel(stage),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: orchestrationStageTone(stage),
    };
  });
}

/** Newest-first recent runs, projected into render-ready rows (wire order kept). */
export function planRunRows(
  overview?: PlanOverview | null,
  now: number = Date.now(),
): PlanRunRow[] {
  return (overview?.recent_runs ?? []).map((run) => {
    const jobCount = nonNegativeCount(run.job_count);
    return {
      id: run.run_id,
      shortId: shortOrchestrationFeedId(run.run_id),
      stageLabel: run.stage ? orchestrationStageLabel(run.stage) : "—",
      stageTone: run.stage ? orchestrationStageTone(run.stage) : "neutral",
      jobCount,
      jobCountLabel: `${jobCount} job${jobCount === 1 ? "" : "s"}`,
      timestamp: run.created_at,
      relativeTime: planOverviewRelativeLabel(run.created_at, now),
    };
  });
}

/** One-line summary for the panel header/footer. */
export function planOverviewSummaryLabel(overview?: PlanOverview | null): string {
  if (!overview) return "";
  const identity = planOverviewIdentity(overview, 0);
  const counts = planOverviewCounts(overview);
  return `Plan in ${identity.projectName} · ${counts.steps} steps · ${counts.runs} runs · ${counts.jobsLinked} jobs linked`;
}

/** False only when the snapshot is missing or has no plan activity. */
export function hasPlanOverviewData(overview?: PlanOverview | null): boolean {
  if (!overview) return false;
  const counts = planOverviewCounts(overview);
  return (
    counts.steps > 0 ||
    counts.runs > 0 ||
    counts.jobsLinked > 0 ||
    (overview.recent_runs?.length ?? 0) > 0
  );
}
