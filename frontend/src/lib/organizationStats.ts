/**
 * Authoritative organization/membership statistics derivation + query helpers (C69 follow-up).
 *
 * The backend (`OrganizationStatsRepository`) derives the whole snapshot from
 * the authoritative auth store on every call — users, organizations and
 * memberships — with no second index. `lib/organizationStats` reproduces that
 * derivation exactly so mock mode stays at feature parity with live mode and
 * the parity guard can drive both transports over the same seeds.
 */

import { ApiError } from "../api/client";
import type {
  Member,
  MemberRole,
  Organization,
  OrganizationMemberCount,
  OrganizationStats,
  RoleMemberCount,
  User,
} from "./types";

/** Optional scope mirrored from the authoritative `/orgs/stats` endpoint. */
export interface OrganizationStatsOptions {
  readonly orgId?: string;
}

/**
 * A membership record annotated with the owning organization. The backend
 * stores an extra `_org_id` discriminator on each member document; the mock
 * seeds model it as `org_id` so the same derivation can scope members to orgs.
 */
export interface OrganizationMemberRecord extends Member {
  readonly org_id: string;
}

/** Canonical member-role order, matching `get_args(MemberRole)` on the backend. */
export const MEMBER_ROLES: readonly MemberRole[] = ["owner", "admin", "member", "viewer"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mirror the router's optional-UUID `org_id` validation so mock and live fail
 * identically with the shared normalized error envelope. An unknown (but
 * well-formed) org is not an error — the backend yields a zero-filled snapshot.
 */
export function validateOrganizationStatsArgs(options: OrganizationStatsOptions = {}): void {
  if (options.orgId !== undefined && !UUID_PATTERN.test(options.orgId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid organization id.",
      details: [{ field: "org_id", message: "org_id must be a valid UUID" }],
    });
  }
}

/** Python-compatible 3-decimal rounding for the derived per-org averages. */
function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * Derive membership metrics exactly as the backend repository does: zero-filled
 * role buckets, per-organization member counts sorted by descending count then
 * org id, a global user total that ignores the org scope, 3-decimal averages and
 * newest-organization recency. An empty scope yields zero counts, zero-filled
 * arrays and a `null` recency (never an error). Recency breaks ties by org id,
 * matching the backend's `(created_at, str(id))` max key.
 */
export function deriveOrganizationStats(
  organizations: readonly Organization[],
  members: readonly OrganizationMemberRecord[],
  users: readonly User[],
  now: string,
  options: OrganizationStatsOptions = {},
): OrganizationStats {
  const scopedOrgs = options.orgId
    ? organizations.filter((org) => org.id === options.orgId)
    : organizations;
  const orgIds = new Set(scopedOrgs.map((org) => org.id));
  const scopedMembers = members.filter((member) => orgIds.has(member.org_id));

  const roleCounts: Record<MemberRole, number> = { owner: 0, admin: 0, member: 0, viewer: 0 };
  const orgCounts = new Map<string, number>();
  for (const org of scopedOrgs) orgCounts.set(org.id, 0);
  for (const member of scopedMembers) {
    roleCounts[member.role] = (roleCounts[member.role] ?? 0) + 1;
    orgCounts.set(member.org_id, (orgCounts.get(member.org_id) ?? 0) + 1);
  }

  const byRole: RoleMemberCount[] = MEMBER_ROLES.map((role) => ({
    role,
    members: roleCounts[role] ?? 0,
  }));
  const byOrganization: OrganizationMemberCount[] = [...orgCounts.entries()]
    .map(([orgId, count]) => ({ org_id: orgId, members: count }))
    .sort((a, b) => b.members - a.members || a.org_id.localeCompare(b.org_id));

  const totalOrganizations = scopedOrgs.length;
  const totalMembers = scopedMembers.length;
  let newest: Organization | undefined;
  for (const org of scopedOrgs) {
    if (
      !newest ||
      org.created_at > newest.created_at ||
      (org.created_at === newest.created_at && org.id > newest.id)
    ) {
      newest = org;
    }
  }

  return {
    total_organizations: totalOrganizations,
    total_members: totalMembers,
    total_users: users.length,
    by_role: byRole,
    by_organization: byOrganization,
    average_members_per_org: totalOrganizations ? round3(totalMembers / totalOrganizations) : 0.0,
    newest_org_at: newest?.created_at ?? null,
    generated_at: now,
  };
}

/** Query-string values for the live `/orgs/stats` request. */
export function organizationStatsQueryParams(
  options: OrganizationStatsOptions = {},
): Record<string, string | number | undefined> {
  return { org_id: options.orgId };
}
