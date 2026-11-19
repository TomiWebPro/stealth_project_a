/**
 * Authoritative orchestration-feed derivation + query helpers (C181 follow-up).
 *
 * The backend (`OrchestrationFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed fresh from the two authoritative
 * orchestration collections — the same stores `/orchestration/*` writes and
 * `/orchestration/stats` aggregates — so the feed and the snapshot can never
 * drift. Plans are projected directly; runs carry only a `plan_id` and are
 * joined back to their plan for project attribution (orphan runs are excluded),
 * matching the stats project-scope join. Project display names are joined from
 * the authoritative project store with a stable "Unknown project" fallback.
 * Ordering is by descending `(created_at, kind, id)` for a deterministic wire
 * shape, and `total` counts the whole filtered feed before the `limit` page.
 *
 * `lib/orchestrationFeed` reproduces that derivation over the same plan/run/
 * project seeds so mock mode stays at feature parity with live mode and the
 * parity guard can drive both transports over identical data. Invalid filter
 * values and page bounds use the shared 422 envelope, matching the router's
 * query validation, and an unknown `project_id` is normalized to a 404 by the
 * fetch.
 */

import { ApiError } from "../api/client";
import type {
  OrchestrationFeed,
  OrchestrationFeedItem,
  OrchestrationFeedKind,
  OrchestrationPlan,
  OrchestrationRun,
} from "./types";

/** Optional scope/filters/page bound mirrored from the authoritative `/orchestration/feed` endpoint. */
export interface OrchestrationFeedOptions {
  readonly projectId?: string;
  readonly kind?: OrchestrationFeedKind;
  readonly limit?: number;
}

/** Canonical orchestration record kinds, matching `get_args(OrchestrationFeedKind)` on the backend. */
export const ORCHESTRATION_FEED_KINDS: readonly OrchestrationFeedKind[] = ["plan", "run"];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const UNKNOWN_PROJECT_NAME = "Unknown project";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `project_id`, optional enum `kind` and
 * bounded `limit` validation so mock and live fail identically with the shared
 * error envelope. An unknown (but well-formed) project is checked against the
 * project seeds by the mock fetch and raises a normalized 404, matching
 * `projects.get_or_raise` on the backend.
 */
export function validateOrchestrationFeedArgs(options: OrchestrationFeedOptions = {}): void {
  if (options.projectId !== undefined && !UUID_PATTERN.test(options.projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
    });
  }
  if (options.kind !== undefined && !ORCHESTRATION_FEED_KINDS.includes(options.kind)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid orchestration feed kind.",
      details: [{ field: "kind", message: "kind must be one of plan, run" }],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/** Python-compatible descending `(created_at, kind, id)` comparison. */
function compareNewest(a: OrchestrationFeedItem, b: OrchestrationFeedItem): number {
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? -1 : 1;
  if (a.kind !== b.kind) return a.kind > b.kind ? -1 : 1;
  if (a.id !== b.id) return a.id > b.id ? -1 : 1;
  return 0;
}

/**
 * Derive the feed exactly as the backend repository does: project each plan
 * directly, join runs to their plan for project attribution (orphans excluded),
 * filter by kind/project, sort newest-first with a `(kind, id)` tie-break and
 * apply the `limit` page. `total` counts the whole filtered feed before paging;
 * an empty scope yields an empty feed (never an error).
 */
export function deriveOrchestrationFeed(
  plans: readonly OrchestrationPlan[],
  runs: readonly OrchestrationRun[],
  projects: readonly { id: string; name: string }[],
  now: string,
  options: OrchestrationFeedOptions = {},
): OrchestrationFeed {
  const { limit = DEFAULT_LIMIT } = options;
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const planProjects = new Map(plans.map((plan) => [plan.plan_id, plan.project_id]));
  const items: OrchestrationFeedItem[] = [];

  if (options.kind === undefined || options.kind === "plan") {
    for (const plan of plans) {
      if (options.projectId !== undefined && plan.project_id !== options.projectId) continue;
      items.push({
        id: plan.plan_id,
        kind: "plan",
        plan_id: plan.plan_id,
        run_id: null,
        project_id: plan.project_id,
        project_name: projectNames.get(plan.project_id) ?? UNKNOWN_PROJECT_NAME,
        goal: plan.goal ?? null,
        stage: null,
        step_count: (plan.steps ?? []).length,
        job_count: 0,
        created_at: plan.created_at,
      });
    }
  }

  if (options.kind === undefined || options.kind === "run") {
    for (const run of runs) {
      const projectId = planProjects.get(run.plan_id);
      if (projectId === undefined) continue; // orphan run: no plan to attribute it to a project
      if (options.projectId !== undefined && projectId !== options.projectId) continue;
      items.push({
        id: run.run_id,
        kind: "run",
        plan_id: run.plan_id,
        run_id: run.run_id,
        project_id: projectId,
        project_name: projectNames.get(projectId) ?? UNKNOWN_PROJECT_NAME,
        goal: null,
        stage: run.stage,
        step_count: 0,
        job_count: (run.job_ids ?? []).length,
        created_at: run.created_at,
      });
    }
  }

  items.sort(compareNewest);
  return { items: items.slice(0, limit), total: items.length, generated_at: now };
}

/** Query-string values for the live `/orchestration/feed` request. */
export function orchestrationFeedQueryParams(
  options: OrchestrationFeedOptions = {},
): Record<string, string | number | undefined> {
  return { project_id: options.projectId, kind: options.kind, limit: options.limit };
}
