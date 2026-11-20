/**
 * Authoritative single-user overview contracts.
 * Mirrors backend/app/schemas/user_overview.py — do not change one side without the other.
 */

import type { Email, Timestamp, Uuid } from "./common";
import type { MemberRole, Project } from "./auth";
import type { Comment } from "./orchestration";

/** Whole-scope totals for one user, derived authoritatively. */
export interface UserOverviewCounts {
  organizations: number;
  projects: number;
  conversations: number;
  comments: number;
  presence: number;
}

/** One organization membership with its joined display name and role. */
export interface UserMembership {
  org_id: Uuid;
  org_name: string;
  role: MemberRole;
  joined_at: Timestamp;
}

/** A single-user snapshot: identity, memberships and recent authored items. */
export interface UserOverview {
  user_id: Uuid;
  email: Email;
  display_name: string;
  avatar_url?: string | null;
  created_at: Timestamp;
  counts: UserOverviewCounts;
  memberships?: UserMembership[];
  recent_projects?: Project[];
  recent_comments?: Comment[];
  generated_at: Timestamp;
}
