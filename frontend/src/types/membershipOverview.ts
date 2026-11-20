/**
 * Authoritative single-membership overview contracts.
 * Mirrors backend/app/schemas/membership_overview.py — do not change one side without the other.
 */

import type { Email, Timestamp, Uuid } from "./common";
import type { MemberRole, Project } from "./auth";
import type { Comment } from "./orchestration";

/** Whole-scope totals for one membership, derived authoritatively. */
export interface MembershipOverviewCounts {
  projects: number;
  conversations: number;
  comments: number;
  presence: number;
}

/** A single-membership snapshot: joined identity, role and recent activity. */
export interface MembershipOverview {
  org_id: Uuid;
  org_name: string;
  org_slug: string;
  user_id: Uuid;
  email: Email;
  display_name: string;
  avatar_url?: string | null;
  role: MemberRole;
  joined_at: Timestamp;
  counts: MembershipOverviewCounts;
  recent_projects?: Project[];
  recent_comments?: Comment[];
  generated_at: Timestamp;
}
