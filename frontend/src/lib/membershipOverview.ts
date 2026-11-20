/**
 * Authoritative single-membership overview derivation + query helpers (C266 follow-up).
 *
 * The backend (`MembershipOverviewRepository`) derives the whole snapshot fresh
 * from the authoritative auth/project/conversation/comment/presence stores on
 * every call — there is no second index. It joins one organization with one user
 * through the `MEMBERS` collection (scoped by the backend's `_org_id` discriminator)
 * for the role/join date, and scopes all activity to projects belonging to that
 * organization and authored by that user. Membership is read from the same
 * authoritative store `/orgs/{id}/members` uses, so role/join data cannot disagree
 * with that endpoint.
 *
 * `counts` describe the whole scope and are never bounded by `recent_limit`;
 * the two recent pages use a deterministic `(created_at, id)` newest-first
 * tie-break. An unknown org/user/membership is a 404 checked by the fetch layer
 * (resolved to `undefined` by the transports); a malformed id or an out-of-range
 * `recent_limit` uses the shared 422 envelope.
 *
 * `lib/membershipOverview` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { OrganizationMemberRecord } from "./organizationStats";
import type {
  Comment,
  Conversation,
  MembershipOverview,
  Organization,
  Presence,
  Project,
  User,
} from "./types";

/** Optional page bound mirrored from the authoritative `/orgs/{org}/members/{user}/overview` endpoint. */
export interface MembershipOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface MembershipOverviewSeeds {
  readonly organizations: readonly Organization[];
  readonly users: readonly User[];
  readonly members: readonly OrganizationMemberRecord[];
  readonly projects: readonly Project[];
  readonly conversations: readonly Conversation[];
  readonly comments: readonly Comment[];
  readonly presence: readonly Presence[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_MEMBERSHIP_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`org_id`/`user_id` UUID and `recent_limit`
 * ge=1, le=50) so mock and live fail identically with the shared normalized error
 * envelope. An unknown-but-valid org/user/membership is a 404 checked by the fetch
 * layer.
 */
export function validateMembershipOverviewArgs(
  orgId: string,
  userId: string,
  options: MembershipOverviewOptions = {},
): void {
  if (!UUID_PATTERN.test(orgId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid organization id.",
      details: [{ field: "org_id", message: "org_id must be a valid UUID" }],
    });
  }
  if (!UUID_PATTERN.test(userId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid user id.",
      details: [{ field: "user_id", message: "user_id must be a valid UUID" }],
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
      message: "Membership overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/** Newest-first `(created_at, id)` comparator used by both recent pages. */
function newestFirst<T extends { created_at: string; id: string }>(a: T, b: T): number {
  return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
}

/**
 * Derive a single-membership snapshot exactly as the backend repository does.
 * `orgId`, `userId` and the membership row are assumed to exist (the fetch layer
 * rejects missing ones with the matching shared 404 envelope). Activity is scoped
 * to projects belonging to the org, and further restricted to the user; counts
 * are computed before the two recent pages are sliced.
 */
export function deriveMembershipOverview(
  orgId: string,
  userId: string,
  seeds: MembershipOverviewSeeds,
  options: MembershipOverviewOptions = {},
): MembershipOverview {
  const organization = seeds.organizations.find((candidate) => candidate.id === orgId);
  if (!organization) {
    throw new ApiError({
      status: 404,
      code: "organization_not_found",
      message: `Organization '${orgId}' was not found.`,
    });
  }
  const user = seeds.users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new ApiError({
      status: 404,
      code: "user_not_found",
      message: `User '${userId}' was not found.`,
    });
  }
  const membership = seeds.members.find(
    (candidate) => candidate.org_id === orgId && candidate.user_id === userId,
  );
  if (!membership) {
    throw new ApiError({
      status: 404,
      code: "membership_not_found",
      message: `Membership '${orgId}:${userId}' was not found.`,
    });
  }

  const orgProjectIds = new Set(
    seeds.projects.filter((project) => project.org_id === orgId).map((project) => project.id),
  );
  const authoredProjects = seeds.projects.filter(
    (project) => project.org_id === orgId && project.created_by === userId,
  );
  const conversations = seeds.conversations.filter(
    (conversation) =>
      conversation.created_by === userId && orgProjectIds.has(conversation.project_id),
  );
  const comments = seeds.comments.filter(
    (comment) => comment.author_id === userId && orgProjectIds.has(comment.project_id),
  );
  const presence = seeds.presence.filter(
    (signal) => signal.user_id === userId && orgProjectIds.has(signal.project_id),
  );

  const counts: MembershipOverview["counts"] = {
    projects: authoredProjects.length,
    conversations: conversations.length,
    comments: comments.length,
    presence: presence.length,
  };

  const { recentLimit = DEFAULT_MEMBERSHIP_OVERVIEW_RECENT_LIMIT } = options;
  const recentProjects = [...authoredProjects].sort(newestFirst).slice(0, recentLimit);
  const recentComments = [...comments].sort(newestFirst).slice(0, recentLimit);

  return {
    org_id: organization.id,
    org_name: organization.name,
    org_slug: organization.slug,
    user_id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url ?? null,
    role: membership.role,
    joined_at: membership.joined_at,
    counts,
    recent_projects: recentProjects,
    recent_comments: recentComments,
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/orgs/{org}/members/{user}/overview` request. */
export function membershipOverviewQueryParams(
  options: MembershipOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
