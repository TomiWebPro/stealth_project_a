/**
 * Authoritative single-user overview derivation + query helpers (C262 follow-up).
 *
 * The backend (`UserOverviewRepository`) derives the whole snapshot fresh from
 * the authoritative auth/project/conversation/comment/presence stores on every
 * call — there is no second index. It projects one user's identity, every
 * organization membership (with the org name joined from the authoritative
 * organization store) and whole-scope activity counts, plus bounded newest-first
 * recent projects/comments authored by that user. Membership is read from the
 * same authoritative store `/orgs/{id}/members` uses, so role/identity data
 * cannot disagree with that endpoint.
 *
 * `counts` describe the whole scope and are never bounded by `recent_limit`;
 * the two recent pages use a deterministic `(created_at, id)` newest-first
 * tie-break. An unknown user is a 404 checked by the fetch layer (resolved to
 * `undefined` by the transports); a malformed id or an out-of-range
 * `recent_limit` uses the shared 422 envelope.
 *
 * `lib/userOverview` reproduces that derivation over the same seeds so mock
 * mode stays at feature parity with live mode and the parity guard can drive
 * both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { OrganizationMemberRecord } from "./organizationStats";
import type {
  Comment,
  Conversation,
  Organization,
  Presence,
  Project,
  User,
  UserMembership,
  UserOverview,
} from "./types";

/** Optional page bound mirrored from the authoritative `/users/{id}/overview` endpoint. */
export interface UserOverviewOptions {
  readonly recentLimit?: number;
}

/** Seeds the derivation reads, all sourced from the same authoritative stores. */
export interface UserOverviewSeeds {
  readonly users: readonly User[];
  readonly organizations: readonly Organization[];
  readonly members: readonly OrganizationMemberRecord[];
  readonly projects: readonly Project[];
  readonly conversations: readonly Conversation[];
  readonly comments: readonly Comment[];
  readonly presence: readonly Presence[];
  /** Injected clock value (`generated_at`); fixed in mock tests for determinism. */
  readonly now: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNKNOWN_ORG_NAME = "Unknown organization";
export const DEFAULT_USER_OVERVIEW_RECENT_LIMIT = 5;
const MAX_RECENT_LIMIT = 50;

/**
 * Mirror the router's validation (`user_id` UUID and `recent_limit` ge=1, le=50)
 * so mock and live fail identically with the shared normalized error envelope.
 * An unknown-but-valid user is a 404 checked by the fetch layer.
 */
export function validateUserOverviewArgs(
  userId: string,
  options: UserOverviewOptions = {},
): void {
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
      message: "User overview recent limit must be between 1 and 50.",
      details: [{ field: "recent_limit", message: "recent_limit must be between 1 and 50" }],
    });
  }
}

/** Newest-first `(created_at, id)` comparator used by both recent pages. */
function newestFirst<T extends { created_at: string; id: string }>(a: T, b: T): number {
  return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
}

/**
 * Derive a single-user snapshot exactly as the backend repository does.
 * `userId` is assumed to exist (the fetch layer rejects unknown users); an
 * unseeded user throws the shared 404 envelope. Every membership is projected
 * with a joined org name and a stable "Unknown organization" fallback, sorted
 * newest-first by `(joined_at, org_id)` and never bounded by the page. Whole-scope
 * counts are computed before the two recent pages are sliced.
 */
export function deriveUserOverview(
  userId: string,
  seeds: UserOverviewSeeds,
  options: UserOverviewOptions = {},
): UserOverview {
  const user = seeds.users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw new ApiError({
      status: 404,
      code: "user_not_found",
      message: `User '${userId}' was not found.`,
    });
  }

  const orgNames = new Map(seeds.organizations.map((org) => [org.id, org.name]));

  const memberships: UserMembership[] = seeds.members
    .filter((member) => member.user_id === userId)
    .map((member) => ({
      org_id: member.org_id,
      org_name: orgNames.get(member.org_id) ?? UNKNOWN_ORG_NAME,
      role: member.role,
      joined_at: member.joined_at,
    }))
    .sort(
      (a, b) => b.joined_at.localeCompare(a.joined_at) || b.org_id.localeCompare(a.org_id),
    );

  const projects = seeds.projects.filter((project) => project.created_by === userId);
  const conversations = seeds.conversations.filter(
    (conversation) => conversation.created_by === userId,
  );
  const comments = seeds.comments.filter((comment) => comment.author_id === userId);
  const presence = seeds.presence.filter((signal) => signal.user_id === userId);

  const counts: UserOverview["counts"] = {
    organizations: memberships.length,
    projects: projects.length,
    conversations: conversations.length,
    comments: comments.length,
    presence: presence.length,
  };

  const { recentLimit = DEFAULT_USER_OVERVIEW_RECENT_LIMIT } = options;
  const recentProjects = [...projects].sort(newestFirst).slice(0, recentLimit);
  const recentComments = [...comments].sort(newestFirst).slice(0, recentLimit);

  return {
    user_id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url ?? null,
    created_at: user.created_at,
    counts,
    memberships,
    recent_projects: recentProjects,
    recent_comments: recentComments,
    generated_at: seeds.now,
  };
}

/** Query-string values for the live `/users/{id}/overview` request. */
export function userOverviewQueryParams(
  options: UserOverviewOptions = {},
): Record<string, string | number | undefined> {
  return { recent_limit: options.recentLimit };
}
