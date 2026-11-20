/**
 * Authoritative single-organization overview derivation + query helpers (C226
 * follow-up).
 *
 * The backend (`OrganizationOverviewRepository`) derives the whole snapshot
 * fresh from the authoritative auth/project stores on every call — there is no
 * second index. It projects one organization's identity, whole-scope
 * membership/project counts, a zero-filled member-role breakdown and a bounded
 * newest-first list of members/projects. Membership is read from the same
 * authoritative store `GET /orgs/{id}/members` uses, so the role and identity
 * data cannot disagree with that endpoint.
 *
 * `lib/organizationOverview` reproduces that derivation over the same seeds so
 * mock mode stays at feature parity with live mode and the parity guard can
 * drive both transports over identical data. The role buckets reuse the
 * canonical values from `/orgs/stats`, so the snapshot cannot disagree with the
 * workspace-wide view. An unknown organization is a 404 checked by the fetch
 * layer (resolved to `undefined` by the transports); a malformed id or an
 * out-of-range `recent_limit` uses the shared 422 envelope.
 */

import { ApiError } from "../api/client";
import { MEMBER_ROLES } from "./organizationStats";
import type { OrganizationMemberRecord } from "./organizationStats";
import type { Member, Organization, OrganizationOverview, Project, RoleMemberCount } from "./types";

/** Optional page bound mirrored from the authoritative `/orgs/{id}/overview` endpoint. */
export interface OrganizationOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface OrganizationOverviewSeeds {
  readonly organizations: readonly Organization[];
  readonly members: readonly OrganizationMemberRecord[];
  readonly projects: readonly Project[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_ORGANIZATION_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`org_id` UUID and `recent_limit` ge=1, le=50)
 * so mock and live fail identically with the shared normalized error envelope.
 * An unknown-but-valid organization is a 404 checked by the fetch layer.
 */
export function validateOrganizationOverviewArgs(
  orgId: string,
  options: OrganizationOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(orgId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid organization id.",
      details: [{ field: "org_id", message: "org_id must be a valid UUID" }],
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
      message: "Organization overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/**
 * Project a membership seed onto the authoritative `Member` wire shape, dropping
 * the mock-only `org_id` discriminator the backend keeps as an internal `_org_id`.
 */
function toMember(record: OrganizationMemberRecord): Member {
  return {
    user_id: record.user_id,
    email: record.email,
    display_name: record.display_name,
    role: record.role,
    joined_at: record.joined_at,
  };
}

/**
 * Derive a single-organization snapshot exactly as the backend repository does.
 * `orgId` is assumed to exist (the fetch layer rejects unknown organizations);
 * an unseeded organization yields a 404. Members are sorted newest-first with a
 * `(joined_at, user_id)` tie-break and projects with `(created_at, id)`; the
 * zero-filled role buckets and the whole-scope counts are never bounded by the
 * recent page.
 */
export function deriveOrganizationOverview(
  orgId: string,
  seeds: OrganizationOverviewSeeds,
  options: OrganizationOverviewOptions = {},
): OrganizationOverview {
  const org = seeds.organizations.find((candidate) => candidate.id === orgId);
  if (!org) {
    throw new ApiError({
      status: 404,
      code: "organization_not_found",
      message: `Organization '${orgId}' was not found.`,
    });
  }

  const { recentLimit = DEFAULT_ORGANIZATION_OVERVIEW_RECENT_LIMIT } = options;
  const members = seeds.members.filter((member) => member.org_id === orgId);
  const projects = seeds.projects.filter((project) => project.org_id === orgId);

  const roleCounts = new Map<string, number>();
  for (const member of members) {
    roleCounts.set(member.role, (roleCounts.get(member.role) ?? 0) + 1);
  }
  const byRole: RoleMemberCount[] = MEMBER_ROLES.map((role) => ({
    role,
    members: roleCounts.get(role) ?? 0,
  }));

  const recentMembers = [...members]
    .sort(
      (a, b) =>
        b.joined_at.localeCompare(a.joined_at) || b.user_id.localeCompare(a.user_id),
    )
    .slice(0, recentLimit)
    .map(toMember);
  const recentProjects = [...projects]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
    .slice(0, recentLimit);

  return {
    org_id: org.id,
    name: org.name,
    slug: org.slug,
    created_at: org.created_at,
    counts: { members: members.length, projects: projects.length },
    by_role: byRole,
    recent_members: recentMembers,
    recent_projects: recentProjects,
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/orgs/{id}/overview` request. */
export function organizationOverviewQueryParams(
  options: OrganizationOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
