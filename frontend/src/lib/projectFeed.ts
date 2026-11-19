/**
 * Authoritative project feed derivation + query helpers (C145 follow-up).
 *
 * The backend (`ProjectFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of projects fresh from the authoritative
 * `PROJECTS` collection — the same store `GET /projects` lists and
 * `GET /projects/stats` aggregates — so the feed can never drift from those
 * views or from what actually exists. Each item's organization display name is
 * joined from the authoritative organization store (with a stable fallback for
 * a missing org), ordering is by descending `(created_at, project_id)` so the
 * wire shape is byte-for-byte identical across the in-memory and SQLite stores,
 * the `lifecycle` label is derived from the project's `archived` flag, and
 * `total` counts the whole filtered feed before the `limit` page is applied.
 *
 * Unlike resource feeds scoped by resource id, an unknown-but-well-formed
 * `org_id` yields a zero-filled feed (matching `/projects?org_id=` and
 * `/projects/stats?org_id=`); a malformed id, invalid lifecycle or invalid
 * `limit` uses the shared 422 envelope.
 *
 * `lib/projectFeed` reproduces that derivation over the same seeds so mock mode
 * stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { Organization, Project, ProjectFeed, ProjectFeedItem } from "./types";
import type { ProjectLifecycle } from "./types";

/** Optional scope/page/filter mirrored from the authoritative `/projects/feed` endpoint. */
export interface ProjectFeedOptions {
  readonly orgId?: string;
  readonly lifecycle?: ProjectLifecycle;
  readonly limit?: number;
}

/** Kept in sync with the backend `ProjectLifecycle` enum (shared 422 on anything else). */
export const VALID_PROJECT_LIFECYCLES: readonly ProjectLifecycle[] = ["active", "archived"];

/** Stable display name used by the backend when a project's organization is missing. */
export const UNKNOWN_PROJECT_ORG_NAME = "Unknown organization";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed `org_id`, an unknown
 * `lifecycle` or a `limit` outside 1..200 is rejected with a 422. An unknown-
 * but-valid org is not an error — the derivation simply yields an empty feed.
 */
export function validateProjectFeedArgs(options: ProjectFeedOptions = {}): void {
  if (options.orgId !== undefined && !UUID_PATTERN.test(options.orgId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid organization id.",
      details: [{ field: "org_id", message: "org_id must be a valid UUID" }],
    });
  }
  if (options.lifecycle !== undefined && !VALID_PROJECT_LIFECYCLES.includes(options.lifecycle)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid project lifecycle.",
      details: [
        {
          field: "lifecycle",
          message: "lifecycle must be one of active, archived",
        },
      ],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Project feed limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/** Derive the canonical lifecycle label from the project's `archived` flag. */
export function projectLifecycle(project: Project): ProjectLifecycle {
  return project.archived ? "archived" : "active";
}

/**
 * Derive the project feed exactly as the backend repository does: project each
 * project, optionally scope to one organization and/or one lifecycle, join org
 * names (falling back to a stable display name for missing orgs), sort newest-
 * first with a project-id tie-break and apply the `limit` page. A missing
 * `description` defaults to `null`, matching the backend schema. `total` counts
 * the whole filtered feed before paging. An empty scope yields an empty feed
 * (never an error), matching the backend's zero-filled unknown-org behavior.
 */
export function deriveProjectFeed(
  projects: readonly Project[],
  organizations: readonly Organization[],
  now: string,
  options: ProjectFeedOptions = {},
): ProjectFeed {
  const { orgId, lifecycle, limit = DEFAULT_LIMIT } = options;
  const orgNames = new Map(organizations.map((org) => [org.id, org.name]));

  const items: ProjectFeedItem[] = [];
  for (const project of projects) {
    if (orgId !== undefined && project.org_id !== orgId) continue;
    if (lifecycle !== undefined && projectLifecycle(project) !== lifecycle) continue;
    items.push({
      project_id: project.id,
      org_id: project.org_id,
      org_name: orgNames.get(project.org_id) ?? UNKNOWN_PROJECT_ORG_NAME,
      name: project.name,
      description: project.description ?? null,
      lifecycle: projectLifecycle(project),
      created_by: project.created_by,
      created_at: project.created_at,
      updated_at: project.updated_at,
    });
  }

  items.sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) ||
      b.project_id.localeCompare(a.project_id),
  );

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/projects/feed` request. */
export function projectFeedQueryParams(
  options: ProjectFeedOptions = {},
): Record<string, string | number | undefined> {
  return {
    org_id: options.orgId,
    lifecycle: options.lifecycle,
    limit: options.limit,
  };
}
