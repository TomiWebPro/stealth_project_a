/**
 * Authoritative single-organization overview contracts.
 * Mirrors backend/app/schemas/organization_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { Member, Project } from "./auth";
import type { RoleMemberCount } from "./organizationStats";

/** Whole-scope totals for one organization, derived authoritatively. */
export interface OrganizationOverviewCounts {
  members: number;
  projects: number;
}

/** A single-organization snapshot: identity, membership and recent items. */
export interface OrganizationOverview {
  org_id: Uuid;
  name: string;
  slug: string;
  created_at: Timestamp;
  counts: OrganizationOverviewCounts;
  by_role?: RoleMemberCount[];
  recent_members?: Member[];
  recent_projects?: Project[];
  generated_at: Timestamp;
}
