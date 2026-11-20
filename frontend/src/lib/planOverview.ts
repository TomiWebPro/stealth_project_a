/**
 * Authoritative single-orchestration-plan overview derivation + query helpers (C238
 * follow-up).
 *
 * The backend (`PlanOverviewRepository`) derives the whole snapshot fresh from
 * the authoritative `ORCHESTRATION_PLANS` and `ORCHESTRATION_RUNS` collections —
 * the same stores `/orchestration/*` writes and `/orchestration/stats` aggregates —
 * with the project display name joined from the authoritative project store. There
 * is no second index. `by_stage` reuses the exact zero-filled stage derivation the
 * orchestration stats view uses, so the overview can never disagree with it, while
 * `recent_runs` is a bounded newest-first projection of the plan's runs (orphan
 * runs belonging to another plan are excluded) and `counts` is never bounded.
 *
 * `lib/planOverview` reproduces that derivation over the same plan/run/project
 * seeds so mock mode stays at feature parity with live mode and the parity guard
 * can drive both transports over identical data. An unknown plan is a 404 checked
 * by the fetch layer and normalized to `undefined` by the transports; a malformed
 * id or an out-of-range `recent_limit` uses the shared 422 envelope.
 */

import { ApiError } from "../api/client";
import { ORCHESTRATION_STAGES } from "./orchestrationStats";
import type {
  OrchestrationPlan,
  OrchestrationRun,
  OrchestrationStage,
  OrchestrationStageCount,
  PlanOverview,
  PlanOverviewRunRef,
  Project,
} from "./types";

/** Optional page bound mirrored from the authoritative `/orchestration/plans/{id}/overview` endpoint. */
export interface PlanOverviewOptions {
  readonly recentLimit?: number;
}

/** Stable display name used by the backend when a plan's project is missing. */
export const UNKNOWN_PLAN_OVERVIEW_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_PLAN_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/** Python-compatible lexicographic comparison (matches `sorted()` on str). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Descending `(created_at, str(run_id))` comparison, matching the backend's `reverse=True`. */
function compareNewest(a: OrchestrationRun, b: OrchestrationRun): number {
  const byTime = compareStrings(b.created_at, a.created_at);
  return byTime !== 0 ? byTime : compareStrings(b.run_id, a.run_id);
}

/**
 * Mirror the router's validation (`plan_id` UUID and `recent_limit` ge=1, le=50)
 * so mock and live fail identically with the shared normalized error envelope.
 * An unknown-but-valid plan is a 404 checked by the fetch layer.
 */
export function validatePlanOverviewArgs(
  planId: string,
  options: PlanOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(planId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid plan id.",
      details: [{ field: "plan_id", message: "plan_id must be a valid UUID" }],
    });
  }
  const { recentLimit } = options;
  if (
    recentLimit !== undefined &&
    (!Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > MAX_RECENT_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Plan overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-plan snapshot exactly as the backend repository does. `planId`
 * is assumed to exist (the fetch layer rejects unknown plans); an unseeded plan
 * throws the shared 404 envelope. Runs are joined to the requested plan id, so
 * orphan runs of another plan are never attributed. `counts` and `by_stage`
 * describe the whole plan and are never bounded by `recent_limit`, while the
 * recent runs list is newest-first and bounded. A missing project falls back to
 * a stable display name, and a plan without a goal yields `null`.
 */
export function derivePlanOverview(
  planId: string,
  plans: readonly OrchestrationPlan[],
  runs: readonly OrchestrationRun[],
  projects: readonly Project[],
  now: string,
  options: PlanOverviewOptions = {},
): PlanOverview {
  const plan = plans.find((candidate) => candidate.plan_id === planId);
  if (!plan) {
    throw new ApiError({
      status: 404,
      code: "plan_not_found",
      message: `Orchestration plan '${planId}' was not found.`,
    });
  }

  const { recentLimit = DEFAULT_PLAN_OVERVIEW_RECENT_LIMIT } = options;
  const projectName =
    projects.find((candidate) => candidate.id === plan.project_id)?.name ??
    UNKNOWN_PLAN_OVERVIEW_PROJECT_NAME;
  const planRuns = runs.filter((run) => run.plan_id === planId);

  const stageCounts = new Map<OrchestrationStage, number>();
  for (const run of planRuns) {
    stageCounts.set(run.stage, (stageCounts.get(run.stage) ?? 0) + 1);
  }
  const byStage: OrchestrationStageCount[] = ORCHESTRATION_STAGES.map((stage) => ({
    stage,
    count: stageCounts.get(stage) ?? 0,
  }));

  const recentRuns: PlanOverviewRunRef[] = planRuns
    .slice()
    .sort(compareNewest)
    .slice(0, recentLimit)
    .map((run) => ({
      run_id: run.run_id,
      stage: run.stage,
      job_count: (run.job_ids ?? []).length,
      created_at: run.created_at,
    }));

  return {
    plan_id: planId,
    project_id: plan.project_id,
    project_name: projectName,
    goal: plan.goal ?? null,
    created_at: plan.created_at,
    counts: {
      steps: (plan.steps ?? []).length,
      runs: planRuns.length,
      jobs_linked: planRuns.reduce((total, run) => total + (run.job_ids ?? []).length, 0),
    },
    by_stage: byStage,
    recent_runs: recentRuns,
    generated_at: now,
  };
}

/** Query-string values for the live `/orchestration/plans/{id}/overview` request. */
export function planOverviewQueryParams(
  options: PlanOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
