/**
 * Authoritative single-orchestration-run overview derivation + query helpers (C242
 * follow-up).
 *
 * The backend (`RunOverviewRepository`) derives the whole snapshot fresh from the
 * authoritative `ORCHESTRATION_RUNS` collection — the same store the orchestration
 * routers write, `/orchestration/stats` aggregates and `/orchestration/feed` reads —
 * with the parent plan joined from `ORCHESTRATION_PLANS`, the project display name
 * from the authoritative project store and linked jobs from `JOBS`. There is no
 * second index. `by_status` reuses the exact zero-filled status derivation the job
 * stats view uses, so the overview can never disagree with it, while `recent_jobs`
 * is a bounded newest-first projection of the run's linked jobs (duplicate ledger
 * entries collapse and unresolved job ids are skipped) and `counts` is never
 * bounded. An orphan run (missing parent plan) is kept with a stable unknown
 * project fallback rather than dropped.
 *
 * `lib/runOverview` reproduces that derivation over the same run/plan/job/project
 * seeds so mock mode stays at feature parity with live mode and the parity guard
 * can drive both transports over identical data. An unknown run is a 404 checked
 * by the fetch layer and normalized to `undefined` by the transports; a malformed
 * id or an out-of-range `recent_limit` uses the shared 422 envelope.
 */

import { ApiError } from "../api/client";
import { JOB_STATUSES } from "./jobStats";
import type {
  Job,
  JobStatusCount,
  OrchestrationPlan,
  OrchestrationRun,
  Project,
  RunOverview,
  RunOverviewJobRef,
} from "./types";

/** Optional page bound mirrored from the authoritative `/orchestration/runs/{id}/overview` endpoint. */
export interface RunOverviewOptions {
  readonly recentLimit?: number;
}

/** Stable display name used by the backend when a run's project cannot be resolved. */
export const UNKNOWN_RUN_OVERVIEW_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_RUN_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/** Python-compatible lexicographic comparison (matches `sorted()` on str). */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Descending `(created_at, job.id)` comparison, matching the backend's `reverse=True`. */
function compareNewestJob(a: Job, b: Job): number {
  const byTime = compareStrings(b.created_at, a.created_at);
  return byTime !== 0 ? byTime : compareStrings(b.id, a.id);
}

/**
 * Mirror the router's validation (`run_id` UUID and `recent_limit` ge=1, le=50)
 * so mock and live fail identically with the shared normalized error envelope.
 * An unknown-but-valid run is a 404 checked by the fetch layer.
 */
export function validateRunOverviewArgs(
  runId: string,
  options: RunOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(runId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid run id.",
      details: [{ field: "run_id", message: "run_id must be a valid UUID" }],
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
      message: "Run overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Derive a single-run snapshot exactly as the backend repository does. `runId`
 * is assumed to exist (the fetch layer rejects unknown runs); an unseeded run
 * throws the shared 404 envelope. The parent plan and project name are joined when
 * present, with "Unknown project" and null goal/id fallbacks for an orphan run.
 * Duplicate linked job ids collapse (the count still reflects declared links) and
 * ids without an authoritative job are skipped. `counts` and `by_status` describe
 * the whole run and are never bounded by `recent_limit`, while `recent_jobs` is
 * bounded and newest-first.
 */
export function deriveRunOverview(
  runId: string,
  runs: readonly OrchestrationRun[],
  plans: readonly OrchestrationPlan[],
  jobs: readonly Job[],
  projects: readonly Project[],
  now: string,
  options: RunOverviewOptions = {},
): RunOverview {
  const run = runs.find((candidate) => candidate.run_id === runId);
  if (!run) {
    throw new ApiError({
      status: 404,
      code: "run_not_found",
      message: `Orchestration run '${runId}' was not found.`,
    });
  }

  const { recentLimit = DEFAULT_RUN_OVERVIEW_RECENT_LIMIT } = options;
  const plan = plans.find((candidate) => candidate.plan_id === run.plan_id);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  // The ledger is append-only: collapse duplicate ids but keep the declared link
  // count separate from the resolved-job count.
  const linkedIds = [...new Set(run.job_ids ?? [])];
  const linkedJobs = linkedIds
    .map((jobId) => jobsById.get(jobId))
    .filter((job): job is Job => job !== undefined);

  const statusCounts = new Map<string, number>(
    JOB_STATUSES.map((status): [string, number] => [status, 0]),
  );
  for (const job of linkedJobs) {
    statusCounts.set(job.status, (statusCounts.get(job.status) ?? 0) + 1);
  }
  const byStatus: JobStatusCount[] = JOB_STATUSES.map((status) => ({
    status,
    count: statusCounts.get(status) ?? 0,
  }));

  const recentJobs: RunOverviewJobRef[] = linkedJobs
    .slice()
    .sort(compareNewestJob)
    .slice(0, recentLimit)
    .map((job) => ({
      job_id: job.id,
      operation_id: job.operation_id,
      status: job.status,
      progress: job.progress ?? 0,
      created_at: job.created_at,
    }));

  const projectId = plan?.project_id ?? null;
  const projectName = projectId
    ? projectNames.get(projectId) ?? UNKNOWN_RUN_OVERVIEW_PROJECT_NAME
    : UNKNOWN_RUN_OVERVIEW_PROJECT_NAME;

  return {
    run_id: runId,
    plan_id: run.plan_id,
    project_id: projectId,
    project_name: projectName,
    plan_goal: plan?.goal ?? null,
    stage: run.stage,
    created_at: run.created_at,
    counts: {
      jobs_linked: linkedIds.length,
      jobs_resolved: linkedJobs.length,
      plan_steps: plan ? (plan.steps ?? []).length : 0,
    },
    by_status: byStatus,
    recent_jobs: recentJobs,
    generated_at: now,
  };
}

/** Query-string values for the live `/orchestration/runs/{id}/overview` request. */
export function runOverviewQueryParams(
  options: RunOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
