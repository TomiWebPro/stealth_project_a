/**
 * Authoritative organization/membership statistics contracts.
 * Mirrors backend/app/schemas/organization_stats.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { MemberRole } from "./auth";

/** Number of members holding one role across the scoped organizations. */
export interface RoleMemberCount {
  role: MemberRole;
  members: number;
}

/** Member count for one organization, derived from the membership store. */
export interface OrganizationMemberCount {
  org_id: Uuid;
  members: number;
}

/** Workspace/membership metrics derived from the authoritative auth store. */
export interface OrganizationStats {
  total_organizations: number;
  total_members: number;
  total_users: number;
  by_role?: RoleMemberCount[];
  by_organization?: OrganizationMemberCount[];
  average_members_per_org?: number;
  newest_org_at?: Timestamp | null;
  generated_at: Timestamp;
}
