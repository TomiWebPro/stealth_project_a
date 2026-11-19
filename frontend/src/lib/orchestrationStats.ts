/**
 * Authoritative orchestration statistics derivation + query helpers (C85 follow-up).
 *
 * The backend (`OrchestrationStatsRepository`) derives the whole snapshot from
 * the authoritative `ORCHESTRATION_PLANS` and `ORCHESTRATION_RUNS` stores on
 * every call, with no second index. Runs carry a `plan_id`, so per-project
 * attribution is a join back to the plan that created the run.
 * `lib/orchestrationStats` reproduces that derivation exactly so mock mode stays
 * at feature parity with live mode and the parity guard can drive both
 * transports over the same plan/run seeds.
 */

import { ApiError } from "../api/client";
import type {
  OrchestrationPlan,
  OrchestrationProjectCount,
  OrchestrationRun,
  OrchestrationStage,
  OrchestrationStageCount,
  OrchestrationStats,
} from "./types";

/** Optional scope mirrored from the authoritative `/orchestration/stats` endpoint. */
export interface OrchestrationStatsOptions {
  readonly projectId?: string;
}

/** Canonical run lifecycle stages, matching `get_args(OrchestrationStage)` on the backend. */
export const ORCHESTRATION_STAGES: readonly OrchestrationStage[] = [
  "plan",
  "resolve",
  "submit",
  "await",
  "collect",
  "done",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id` validation so mock and live
 * fail identically with the shared normalized error envelope. An unknown (but
 * well-formed) project is checked against the project seeds by the mock fetch
 * and raises a normalized 404, matching `projects.get_or_raise` on the backend.
 */
export function validateOrchestrationStatsArgs(
  options: OrchestrationStatsOptions = {},
): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
}

/** Python-compatible `(created_at, unique_id)` recency comparison. */
function compareNewestPlan(a: OrchestrationPlan, b: OrchestrationPlan): number {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? 1 : -1;
  if (a.plan_id !== b.plan_id) return a.plan_id > b.plan_id ? 1 : -1;
  return 0;
}

function compareNewestRun(a: OrchestrationRun, b: OrchestrationRun): number {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? 1 : -1;
  if (a.run_id !== b.run_id) return a.run_id > b.run_id ? 1 : -1;
  return 0;
}

/**
 * Derive orchestration metrics exactly as the backend repository does: plans
 * are filtered by the optional project scope, then runs are kept only when
 * their owning plan is in scope (a run→plan join); `by_stage` is zero-filled
 * over every canonical stage; `by_project` lists any project with plans or
 * runs, sorted by descending plan count, then run count, then project id;
 * `total_steps` / `total_jobs_linked` sum plan steps and run job links; both
 * recency fields are `null` when their collection is empty. An empty scope
 * yields zero counts and zero-filled stage buckets (never an error).
 */
export function deriveOrchestrationStats(
  plans: readonly OrchestrationPlan[],
  runs: readonly OrchestrationRun[],
  now: string,
  options: OrchestrationStatsOptions = {},
): OrchestrationStats {
  const scopedPlans = options.projectId
    ? plans.filter((plan) => plan.project_id === options.projectId)
    : plans;
  const planProjects = new Map(scopedPlans.map((plan) => [plan.plan_id, plan.project_id]));
  const scopedRuns = options.projectId
    ? runs.filter((run) => planProjects.has(run.plan_id))
    : runs;

  const stageCounts = new Map<OrchestrationStage, number>();
  const runsByProject = new Map<string, number>();
  let totalJobsLinked = 0;
  let newestRun: OrchestrationRun | undefined;

  for (const run of scopedRuns) {
    stageCounts.set(run.stage, (stageCounts.get(run.stage) ?? 0) + 1);
    totalJobsLinked += (run.job_ids ?? []).length;
    const projectId = planProjects.get(run.plan_id);
    if (projectId !== undefined) {
      runsByProject.set(projectId, (runsByProject.get(projectId) ?? 0) + 1);
    }
    if (!newestRun || compareNewestRun(run, newestRun) > 0) newestRun = run;
  }

  const plansByProject = new Map<string, number>();
  let totalSteps = 0;
  let newestPlan: OrchestrationPlan | undefined;

  for (const plan of scopedPlans) {
    plansByProject.set(plan.project_id, (plansByProject.get(plan.project_id) ?? 0) + 1);
    totalSteps += (plan.steps ?? []).length;
    if (!newestPlan || compareNewestPlan(plan, newestPlan) > 0) newestPlan = plan;
  }

  const byStage: OrchestrationStageCount[] = ORCHESTRATION_STAGES.map((stage) => ({
    stage,
    count: stageCounts.get(stage) ?? 0,
  }));
  const projectIds = new Set([...plansByProject.keys(), ...runsByProject.keys()]);
  const byProject: OrchestrationProjectCount[] = [...projectIds]
    .map((project_id) => ({
      project_id,
      plans: plansByProject.get(project_id) ?? 0,
      runs: runsByProject.get(project_id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.plans - a.plans ||
        b.runs - a.runs ||
        a.project_id.localeCompare(b.project_id),
    );

  return {
    total_plans: scopedPlans.length,
    total_runs: scopedRuns.length,
    total_steps: totalSteps,
    total_jobs_linked: totalJobsLinked,
    by_stage: byStage,
    by_project: byProject,
    newest_plan_at: newestPlan?.created_at ?? null,
    newest_run_at: newestRun?.created_at ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/orchestration/stats` request. */
export function orchestrationStatsQueryParams(
  options: OrchestrationStatsOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId };
}
