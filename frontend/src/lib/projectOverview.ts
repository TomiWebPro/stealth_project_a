/**
 * Authoritative single-project overview derivation + query helpers (C201
 * follow-up).
 *
 * The backend (`ProjectOverviewRepository`) derives the whole snapshot fresh
 * from its authoritative stores on every call — there is no second index. It
 * projects one project's live assets, conversations, jobs, comments, presence
 * and publish/version records onto a compact count snapshot plus a couple of
 * newest-first recent lists. Soft-deleted assets are excluded from counts and
 * recency (matching `/assets`, `/assets/stats` and `/dashboard`), versions of
 * soft-deleted/unknown assets are excluded (matching `/versions/stats`) and the
 * publish count reuses the `/publishes/stats` receipt parser so the two cannot
 * drift. `lib/projectOverview` reproduces that derivation over the same seeds
 * so mock mode stays at feature parity with live mode and the parity guard can
 * drive both transports over identical data.
 *
 * An unknown project is a 404 checked by the fetch layer against the project
 * seeds (resolved to `undefined` by the transports); a malformed id or an
 * out-of-range `recent_limit` uses the shared 422 envelope.
 */

import { ApiError } from "../api/client";
import { hasValidPublishReceipt } from "./publishStats";
import type { AssetVersionRecord } from "./versionStats";
import type { Asset, Comment, Conversation, Job, Presence, Project, ProjectOverview } from "./types";

/** Optional page bound mirrored from the authoritative `/projects/{id}/overview` endpoint. */
export interface ProjectOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface ProjectOverviewSeeds {
  readonly projects: readonly Project[];
  readonly assets: readonly Asset[];
  readonly assetVersions: readonly AssetVersionRecord[];
  readonly conversations: readonly Conversation[];
  readonly jobs: readonly Job[];
  readonly comments: readonly Comment[];
  readonly presence: readonly Presence[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`project_id` UUID and `recent_limit` ge=1,
 * le=50) so mock and live fail identically with the shared normalized error
 * envelope. An unknown-but-valid project is a 404 checked by the fetch layer.
 */
export function validateProjectOverviewArgs(
  projectId: string,
  options: ProjectOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(projectId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project id.",
      details: [{ field: "project_id", message: "project_id must be a valid UUID" }],
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
      message: "Project overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/** Newest-first by `(created_at, id)`, mirroring the repository's reverse sort. */
function newestFirst<T extends { created_at: string; id: string }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || String(b.id).localeCompare(String(a.id)),
  );
}

/**
 * Derive a single-project snapshot exactly as the backend repository does.
 * `projectId` is assumed to exist (the fetch layer rejects unknown projects);
 * an unseeded project yields a zero-filled snapshot with an empty name is never
 * returned by the real transports. Empty domains yield zero counts and empty
 * recent lists (never an error).
 */
export function deriveProjectOverview(
  projectId: string,
  seeds: ProjectOverviewSeeds,
  options: ProjectOverviewOptions = {},
): ProjectOverview {
  const project = seeds.projects.find((candidate) => candidate.id === projectId);
  if (!project) {
    throw new ApiError({ status: 404, code: "not_found", message: "Project not found." });
  }

  const { recentLimit = DEFAULT_OVERVIEW_RECENT_LIMIT } = options;
  const assets = seeds.assets.filter(
    (asset) => asset.project_id === projectId && (asset.status ?? "ready") !== "deleted",
  );
  const liveAssetIds = new Set(assets.map((asset) => asset.id));
  const conversations = seeds.conversations.filter((c) => c.project_id === projectId);
  const jobs = seeds.jobs.filter((job) => job.project_id === projectId);
  const comments = seeds.comments.filter((comment) => comment.project_id === projectId);
  const presence = seeds.presence.filter((signal) => signal.project_id === projectId);
  // Versions of soft-deleted/unknown assets cannot be attributed (matching
  // /versions/stats), keeping the total consistent with the live asset set.
  const versions = seeds.assetVersions.filter((version) => liveAssetIds.has(version.asset_id));
  // Reuse the publish-stats receipt parser so this count cannot drift from
  // GET /publishes/stats for the same project.
  const publishes = assets.filter((asset) =>
    hasValidPublishReceipt(asset.metadata?.["publish_receipt"]),
  ).length;

  return {
    project_id: project.id,
    project_name: project.name,
    lifecycle: project.archived ? "archived" : "active",
    created_at: project.created_at,
    counts: {
      assets: assets.length,
      conversations: conversations.length,
      jobs: jobs.length,
      comments: comments.length,
      publishes,
      versions: versions.length,
      collaborators: new Set(presence.map((signal) => signal.user_id)).size,
    },
    recent_jobs: newestFirst(jobs).slice(0, recentLimit),
    recent_assets: newestFirst(assets).slice(0, recentLimit),
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/projects/{id}/overview` request. */
export function projectOverviewQueryParams(
  options: ProjectOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
