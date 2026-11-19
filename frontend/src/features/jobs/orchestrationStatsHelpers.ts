/**
 * Display models for the authoritative orchestration statistics (C85/C87/C88
 * follow-up). Every value rendered by `OrchestrationStatsPanel` is derived here
 * from the raw `OrchestrationStats` payload so empty, partial and populated
 * states stay consistent across mock and live transports and JSX stays free of
 * inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The stage order mirrors `ORCHESTRATION_STAGES`
 * in `lib/orchestrationStats` so the UI always shows a complete zero-filled
 * lifecycle breakdown.
 */

import type {
  OrchestrationProjectCount,
  OrchestrationStage,
  OrchestrationStats,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface OrchestrationStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface OrchestrationStageRow {
  readonly stage: OrchestrationStage;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all scoped runs, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface OrchestrationProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly plans: number;
  readonly runs: number;
  /** Total orchestration activity (plans + runs) for this project. */
  readonly activity: number;
}

const STAGE_ORDER: readonly OrchestrationStage[] = [
  "plan",
  "resolve",
  "submit",
  "await",
  "collect",
  "done",
];

const STAGE_LABEL: Readonly<Record<OrchestrationStage, string>> = {
  plan: "Plan",
  resolve: "Resolve",
  submit: "Submit",
  await: "Await",
  collect: "Collect",
  done: "Done",
};

const STAGE_TONE: Readonly<Record<OrchestrationStage, BadgeTone>> = {
  plan: "info",
  resolve: "accent",
  submit: "info",
  await: "warning",
  collect: "accent",
  done: "success",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function orchestrationRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Short, stable label for a project id when no friendly name is known. */
export function shortOrchestrationProjectId(projectId: string): string {
  return projectId.length > 8 ? `${projectId.slice(0, 8)}…` : projectId;
}

/** Relative label for the newer of the two authoritative recency signals. */
export function newestOrchestrationSignalLabel(
  stats?: OrchestrationStats,
  now: number = Date.now(),
): string {
  const planAt = stats?.newest_plan_at;
  const runAt = stats?.newest_run_at;
  const planMs = planAt ? Date.parse(planAt) : Number.NaN;
  const runMs = runAt ? Date.parse(runAt) : Number.NaN;
  let newest: string | null | undefined;
  if (Number.isFinite(planMs) && Number.isFinite(runMs)) {
    newest = planMs >= runMs ? planAt : runAt;
  } else if (Number.isFinite(planMs)) {
    newest = planAt;
  } else if (Number.isFinite(runMs)) {
    newest = runAt;
  }
  return orchestrationRelativeLabel(newest, now);
}

/** The four authoritative counters for the stat grid. */
export function orchestrationStatsCards(stats?: OrchestrationStats): OrchestrationStatsCard[] {
  return [
    {
      key: "plans",
      label: "Plans",
      value: String(stats?.total_plans ?? 0),
      hint: "Recorded runs plans",
    },
    {
      key: "runs",
      label: "Runs",
      value: String(stats?.total_runs ?? 0),
      hint: "Execution runs",
    },
    {
      key: "steps",
      label: "Steps",
      value: String(stats?.total_steps ?? 0),
      hint: "Plan steps",
    },
    {
      key: "jobs",
      label: "Jobs linked",
      value: String(stats?.total_jobs_linked ?? 0),
      hint: "Jobs referenced by runs",
    },
  ];
}

/** Zero-filled plan/resolve/submit/await/collect/done distribution. */
export function orchestrationStageRows(stats?: OrchestrationStats): OrchestrationStageRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_stage ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.stage, entry.count);
  }
  const total = STAGE_ORDER.reduce((sum, stage) => sum + (counts.get(stage) ?? 0), 0);
  return STAGE_ORDER.map((stage) => {
    const count = counts.get(stage) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      stage,
      label: STAGE_LABEL[stage] ?? stage,
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: STAGE_TONE[stage] ?? "neutral",
    };
  });
}

/**
 * Per-project plan/run activity. Rows keep the backend's deterministic
 * (descending plans, then runs, then id) order; friendly names are resolved
 * through `projectNames` and fall back to a short id.
 */
export function orchestrationProjectRows(
  stats?: OrchestrationStats,
  projectNames: Readonly<Record<string, string>> = {},
): OrchestrationProjectRow[] {
  return [...(stats?.by_project ?? [])]
    .filter(
      (entry): entry is OrchestrationProjectCount =>
        Boolean(entry) && Number.isFinite(entry.plans) && Number.isFinite(entry.runs),
    )
    .sort(
      (a, b) =>
        b.plans - a.plans ||
        b.runs - a.runs ||
        a.project_id.localeCompare(b.project_id),
    )
    .map((entry) => ({
      projectId: entry.project_id,
      label: projectNames[entry.project_id] || shortOrchestrationProjectId(entry.project_id),
      plans: entry.plans,
      runs: entry.runs,
      activity: entry.plans + entry.runs,
    }));
}

/** True when the snapshot carries any plan, run, step or job link. */
export function hasOrchestrationStatsData(stats?: OrchestrationStats): boolean {
  if (!stats) return false;
  return (
    stats.total_plans > 0 ||
    stats.total_runs > 0 ||
    stats.total_steps > 0 ||
    stats.total_jobs_linked > 0
  );
}

/** Compact relative "generated at" label for the snapshot footer. */
export function orchestrationStatsGeneratedAtLabel(
  stats?: OrchestrationStats,
  now: number = Date.now(),
): string {
  return orchestrationRelativeLabel(stats?.generated_at, now);
}
