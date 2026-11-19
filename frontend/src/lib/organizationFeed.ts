/**
 * Authoritative organization-feed derivation + query helpers (C161 follow-up).
 *
 * The backend (`OrganizationFeedRepository`) keeps no second index: it derives a
 * newest-first, workspace-wide feed of organizations fresh from the authoritative
 * `ORGANIZATIONS` collection — the same store `/orgs` and `/orgs/stats` read — so
 * the three views can never drift. Member and project activity counts are joined
 * from the authoritative `MEMBERS` and `PROJECTS` stores; membership documents
 * carry an extra `_org_id` discriminator, so orphan/malformed memberships and
 * projects of unknown orgs are skipped. Ordering is by descending
 * `(created_at, id)` for a deterministic wire shape across the in-memory and
 * SQLite adapters, and `total` counts the whole feed before the `limit` page.
 *
 * `lib/organizationFeed` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive both
 * transports over identical data.
 */

import { ApiError } from "../api/client";
import type { OrganizationMemberRecord } from "./organizationStats";
import type { Organization, OrganizationFeed, OrganizationFeedItem, Project } from "./types";

/** Optional page bound mirrored from the authoritative `/orgs/feed` endpoint. */
export interface OrganizationFeedOptions {
  readonly limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Mirror the router's `limit` validation so mock and live fail identically with
 * the shared normalized error envelope: a `limit` outside 1..200 is a 422.
 */
export function validateOrganizationFeedArgs(options: OrganizationFeedOptions = {}): void {
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

/**
 * Derive the organization feed exactly as the backend repository does: count
 * only memberships/projects that resolve to an organization in scope, sort
 * newest-first with a stable id tie-break and apply the `limit` page. `total`
 * counts the whole feed before paging. An empty scope yields an empty feed
 * (never an error).
 */
export function deriveOrganizationFeed(
  organizations: readonly Organization[],
  members: readonly OrganizationMemberRecord[],
  projects: readonly Project[],
  now: string,
  options: OrganizationFeedOptions = {},
): OrganizationFeed {
  const { limit = DEFAULT_LIMIT } = options;
  const orgIds = new Set(organizations.map((org) => org.id));

  const memberCounts = new Map<string, number>();
  for (const orgId of orgIds) memberCounts.set(orgId, 0);
  for (const member of members) {
    if (orgIds.has(member.org_id)) {
      memberCounts.set(member.org_id, (memberCounts.get(member.org_id) ?? 0) + 1);
    }
  }

  const projectCounts = new Map<string, number>();
  for (const orgId of orgIds) projectCounts.set(orgId, 0);
  for (const project of projects) {
    if (orgIds.has(project.org_id)) {
      projectCounts.set(project.org_id, (projectCounts.get(project.org_id) ?? 0) + 1);
    }
  }

  const sorted = [...organizations].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  );
  const items: OrganizationFeedItem[] = sorted.map((org) => ({
    org_id: org.id,
    name: org.name,
    slug: org.slug,
    member_count: memberCounts.get(org.id) ?? 0,
    project_count: projectCounts.get(org.id) ?? 0,
    created_at: org.created_at,
  }));

  return {
    items: items.slice(0, limit),
    total: items.length,
    generated_at: now,
  };
}

/** Query-string values for the live `/orgs/feed` request. */
export function organizationFeedQueryParams(
  options: OrganizationFeedOptions = {},
): Record<string, string | number | undefined> {
  return { limit: options.limit };
}
