/**
 * Display models for the authoritative single-user profile overview
 * (C262/C264/C265 follow-up). Every value rendered by `UserOverviewPanel` is
 * derived here from the raw `UserOverview` snapshot so loading/error/missing/
 * empty/populated states stay consistent across mock and live transports and the
 * JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown user) and
 * return zero-filled, render-safe values. Role labels/tones reuse the canonical
 * member-role order so this view cannot drift from the workspace membership and
 * organization-overview breakdowns, and project lifecycle labels match the
 * organization/project views.
 */

import type { UserOverviewOptions } from "../../lib/userOverview";
import type {
  Comment,
  MemberRole,
  Project,
  UserMembership,
  UserOverview,
  UserOverviewCounts,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

const UNKNOWN_USER_LABEL = "Unknown user";
const UNKNOWN_ORG_LABEL = "Unknown organization";

/** Default and offered page bounds for the bounded recent lists (counts are never bounded). */
export const USER_OVERVIEW_RECENT_LIMIT = 10;
export const USER_OVERVIEW_RECENT_LIMITS: readonly number[] = [5, 10, 25];

/** Hook query options for the bounded recent projects/comments. */
export function buildUserOverviewOptions(
  recentLimit: number = USER_OVERVIEW_RECENT_LIMIT,
): UserOverviewOptions {
  return { recentLimit };
}

const ROLE_ORDER: readonly MemberRole[] = ["owner", "admin", "member", "viewer"];

const ROLE_LABEL: Readonly<Record<MemberRole, string>> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_TONE: Readonly<Record<MemberRole, BadgeTone>> = {
  owner: "accent",
  admin: "info",
  member: "success",
  viewer: "neutral",
};

const COUNT_DEFS: readonly {
  readonly key: keyof UserOverviewCounts;
  readonly label: string;
  readonly hint: string;
}[] = [
  { key: "organizations", label: "Organizations", hint: "Memberships held" },
  { key: "projects", label: "Projects", hint: "Authored in the workspace" },
  { key: "conversations", label: "Conversations", hint: "Started by this user" },
  { key: "comments", label: "Comments", hint: "Authored by this user" },
  { key: "presence", label: "Presence", hint: "Recorded sessions" },
];

/** Render-ready one whole-scope count card. */
export interface UserOverviewStat {
  readonly key: keyof UserOverviewCounts;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

/** Identity/context for the snapshot header. */
export interface UserOverviewIdentity {
  readonly displayName: string;
  readonly email: string;
  readonly avatarInitial: string;
  readonly shortId: string;
  readonly createdLabel: string;
}

/** One organization membership, projected into render-safe labels. */
export interface UserOverviewMembershipRow {
  readonly key: string;
  readonly orgName: string;
  readonly roleLabel: string;
  readonly roleTone: BadgeTone;
  readonly joinedLabel: string;
}

/** One recent authored project, projected into render-safe labels. */
export interface UserOverviewProjectRow {
  readonly key: string;
  readonly id: string;
  readonly name: string;
  readonly lifecycleLabel: string;
  readonly lifecycleTone: BadgeTone;
  readonly createdLabel: string;
  readonly updatedLabel: string;
}

/** One recent authored comment, projected into render-safe labels. */
export interface UserOverviewCommentRow {
  readonly key: string;
  readonly id: string;
  readonly projectId: string;
  readonly assetId: string;
  readonly bodyPreview: string;
  readonly hasAsset: boolean;
  readonly timestamp: string;
  readonly createdLabel: string;
}

/** Coerce any raw value into a non-negative integer count. */
function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

/** Compact relative label for a timestamp, or "" when absent. */
export function userOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function userOverviewGeneratedAtLabel(
  overview?: UserOverview | null,
  now: number = Date.now(),
): string {
  return userOverviewRelativeLabel(overview?.generated_at, now);
}

/** Short, human-friendly label for a user id in a compact header. */
export function userOverviewShortId(userId?: string | null): string {
  if (!userId) return "—";
  return userId.length > 8 ? `${userId.slice(0, 8)}…` : userId;
}

/** Friendly display name, falling back to the email then a stable placeholder. */
export function userOverviewDisplayName(overview?: UserOverview | null): string {
  if (typeof overview?.display_name === "string" && overview.display_name.trim() !== "") {
    return overview.display_name;
  }
  if (typeof overview?.email === "string" && overview.email.trim() !== "") {
    return overview.email;
  }
  return UNKNOWN_USER_LABEL;
}

/** Single uppercase avatar initial derived from the display name. */
export function userOverviewAvatarInitial(overview?: UserOverview | null): string {
  return userOverviewDisplayName(overview).charAt(0).toUpperCase() || "?";
}

/** Identity labels for the snapshot header. */
export function userOverviewIdentity(
  overview?: UserOverview | null,
  now: number = Date.now(),
): UserOverviewIdentity {
  return {
    displayName: userOverviewDisplayName(overview),
    email: typeof overview?.email === "string" ? overview.email : "",
    avatarInitial: userOverviewAvatarInitial(overview),
    shortId: userOverviewShortId(overview?.user_id),
    createdLabel: userOverviewRelativeLabel(overview?.created_at, now),
  };
}

/** One authoritative count, zero-filled for missing/malformed snapshots. */
export function userOverviewCount(
  overview?: UserOverview | null,
  key: keyof UserOverviewCounts = "organizations",
): number {
  return nonNegativeCount(overview?.counts?.[key]);
}

/** All authoritative whole-scope counts, zero-filled in a stable shape. */
export function userOverviewCounts(overview?: UserOverview | null): UserOverviewCounts {
  return {
    organizations: userOverviewCount(overview, "organizations"),
    projects: userOverviewCount(overview, "projects"),
    conversations: userOverviewCount(overview, "conversations"),
    comments: userOverviewCount(overview, "comments"),
    presence: userOverviewCount(overview, "presence"),
  };
}

/** The five headline counters, in a stable display order. */
export function userOverviewStatRows(overview?: UserOverview | null): UserOverviewStat[] {
  return COUNT_DEFS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    value: String(userOverviewCount(overview, key)),
  }));
}

/** Role label/ tone pair, with a stable fallback for unexpected roles. */
export function userOverviewRole(role?: MemberRole | null): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  const known = role && ROLE_ORDER.includes(role) ? role : null;
  return {
    label: known ? ROLE_LABEL[known] : (role ?? "Unknown"),
    tone: known ? ROLE_TONE[known] : "neutral",
  };
}

/** Every organization membership, projected into render-safe rows. */
export function userOverviewMembershipRows(
  overview?: UserOverview | null,
  now: number = Date.now(),
): UserOverviewMembershipRow[] {
  return (overview?.memberships ?? []).map((membership: UserMembership, index: number) => {
    const role = userOverviewRole(membership?.role);
    return {
      key: membership?.org_id || `membership-${index}`,
      orgName:
        typeof membership?.org_name === "string" && membership.org_name.trim() !== ""
          ? membership.org_name
          : UNKNOWN_ORG_LABEL,
      roleLabel: role.label,
      roleTone: role.tone,
      joinedLabel: userOverviewRelativeLabel(membership?.joined_at, now),
    };
  });
}

/** Lifecycle badge for an archived/active project (matches the project views). */
export function userOverviewLifecycle(project?: Project | null): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  return project?.archived
    ? { label: "Archived", tone: "neutral" }
    : { label: "Active", tone: "success" };
}

/** Newest authored projects, projected into render-safe rows. */
export function userOverviewRecentProjects(
  overview?: UserOverview | null,
  now: number = Date.now(),
): UserOverviewProjectRow[] {
  return (overview?.recent_projects ?? []).map((project: Project, index: number) => {
    const lifecycle = userOverviewLifecycle(project);
    return {
      key: project?.id || `project-${index}`,
      id: typeof project?.id === "string" ? project.id : "",
      name:
        typeof project?.name === "string" && project.name.trim() !== ""
          ? project.name
          : "Unnamed project",
      lifecycleLabel: lifecycle.label,
      lifecycleTone: lifecycle.tone,
      createdLabel: userOverviewRelativeLabel(project?.created_at, now),
      updatedLabel: userOverviewRelativeLabel(project?.updated_at, now),
    };
  });
}

const COMMENT_PREVIEW_MAX = 120;

/** Whitespace-normalized, truncated single-line body preview. */
export function userOverviewCommentPreview(body?: string | null): string {
  const normalized = typeof body === "string" ? body.replace(/\s+/g, " ").trim() : "";
  if (normalized.length <= COMMENT_PREVIEW_MAX) return normalized;
  return `${normalized.slice(0, COMMENT_PREVIEW_MAX - 1).trimEnd()}…`;
}

/** Newest authored comments, projected into render-safe rows. */
export function userOverviewRecentComments(
  overview?: UserOverview | null,
  now: number = Date.now(),
): UserOverviewCommentRow[] {
  return (overview?.recent_comments ?? []).map((comment: Comment, index: number) => {
    const assetId = typeof comment?.asset_id === "string" ? comment.asset_id : "";
    const timestamp = typeof comment?.created_at === "string" ? comment.created_at : "";
    return {
      key: comment?.id || `comment-${index}`,
      id: typeof comment?.id === "string" ? comment.id : "",
      projectId: typeof comment?.project_id === "string" ? comment.project_id : "",
      assetId,
      bodyPreview: userOverviewCommentPreview(comment?.body),
      hasAsset: assetId !== "",
      timestamp,
      createdLabel: userOverviewRelativeLabel(timestamp, now),
    };
  });
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasUserOverviewData(overview?: UserOverview | null): boolean {
  if (!overview) return false;
  const counts = userOverviewCounts(overview);
  return (
    counts.organizations > 0 ||
    counts.projects > 0 ||
    counts.conversations > 0 ||
    counts.comments > 0 ||
    counts.presence > 0 ||
    (overview.memberships?.length ?? 0) > 0 ||
    (overview.recent_projects?.length ?? 0) > 0 ||
    (overview.recent_comments?.length ?? 0) > 0
  );
}

/** One-line summary for the panel footer. */
export function userOverviewSummaryLabel(overview?: UserOverview | null): string {
  if (!overview) return "";
  const counts = userOverviewCounts(overview);
  return [
    `${counts.organizations} org${counts.organizations === 1 ? "" : "s"}`,
    `${counts.projects} project${counts.projects === 1 ? "" : "s"}`,
    `${counts.comments} comment${counts.comments === 1 ? "" : "s"}`,
  ].join(" · ");
}
