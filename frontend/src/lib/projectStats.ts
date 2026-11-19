/**
 * Authoritative project portfolio statistics derivation + query helpers (C53 follow-up).
 *
 * The backend (`ProjectStatsRepository`) derives the whole snapshot from the
 * authoritative project/asset/conversation/job stores on every call — there is
 * no second index. `lib/projectStats` reproduces that derivation exactly so
 * mock mode stays at feature parity with live mode and the parity guard can
 * drive both transports over the same seeds.
 */

import { ApiError } from "../api/client";
import type {
  Asset,
  Conversation,
  Job,
  Project,
  ProjectLifecycle,
  ProjectLifecycleCount,
  ProjectStats,
} from "./types";

/** Optional scope mirrored from the authoritative `/projects/stats` endpoint. */
export interface ProjectStatsOptions {
  readonly orgId?: string;
}

/** Canonical lifecycle order, matching `get_args(ProjectLifecycle)` on the backend. */
export const PROJECT_LIFECYCLES: readonly ProjectLifecycle[] = ["active", "archived"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `org_id` validation so mock and live fail
 * identically with the shared normalized error envelope. An unknown (but
 * well-formed) org is not an error — the backend yields a zero-filled snapshot.
 */
export function validateProjectStatsArgs(options: ProjectStatsOptions = {}): void {
  if (options.orgId !== undefined && !UUID_PATTERN.test(options.orgId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid organization id.",
      details: [{ field: "org_id", message: "org_id must be a valid UUID" }],
    });
  }
}

/** Python-compatible 3-decimal rounding for the derived per-project averages. */
function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * Derive project portfolio metrics exactly as the backend repository does:
 * zero-filled lifecycle counts, workspace-wide (or org-scoped) domain totals,
 * per-project averages and newest-project recency. Soft-deleted assets are
 * excluded; an optional org narrows projects and the domain documents belonging
 * to them. An empty scope yields zero counts, zero-filled arrays and a `null`
 * recency (never an error). Recency breaks ties by project id, matching the
 * backend's `(created_at, str(id))` max key.
 */
export function deriveProjectStats(
  projects: readonly Project[],
  assets: readonly Asset[],
  conversations: readonly Conversation[],
  jobs: readonly Job[],
  now: string,
  options: ProjectStatsOptions = {},
): ProjectStats {
  const scopedProjects = options.orgId
    ? projects.filter((project) => project.org_id === options.orgId)
    : projects;
  const projectIds = new Set(scopedProjects.map((project) => project.id));

  const scopedAssets = assets.filter(
    (asset) =>
      (asset.status ?? "ready") !== "deleted" &&
      (!options.orgId || projectIds.has(asset.project_id)),
  );
  const scopedConversations = conversations.filter(
    (conversation) => !options.orgId || projectIds.has(conversation.project_id),
  );
  const scopedJobs = jobs.filter(
    (job) => !options.orgId || projectIds.has(job.project_id),
  );

  const archived = scopedProjects.filter((project) => project.archived).length;
  const active = scopedProjects.length - archived;
  const counts: Record<ProjectLifecycle, number> = { active, archived };
  const byLifecycle: ProjectLifecycleCount[] = PROJECT_LIFECYCLES.map((lifecycle) => ({
    lifecycle,
    count: counts[lifecycle] ?? 0,
  }));

  const total = scopedProjects.length;
  let newest: Project | undefined;
  for (const project of scopedProjects) {
    if (
      !newest ||
      project.created_at > newest.created_at ||
      (project.created_at === newest.created_at && project.id > newest.id)
    ) {
      newest = project;
    }
  }

  return {
    total,
    by_lifecycle: byLifecycle,
    active,
    archived,
    total_assets: scopedAssets.length,
    total_conversations: scopedConversations.length,
    total_jobs: scopedJobs.length,
    average_assets_per_project: total ? round3(scopedAssets.length / total) : 0.0,
    average_jobs_per_project: total ? round3(scopedJobs.length / total) : 0.0,
    newest_project_at: newest?.created_at ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/projects/stats` request. */
export function projectStatsQueryParams(
  options: ProjectStatsOptions = {},
): Record<string, string | number | undefined> {
  return { org_id: options.orgId };
}
