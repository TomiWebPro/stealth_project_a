/**
 * Display models for the authoritative single-membership overview
 * (C266/C268/C269 follow-up). Every value rendered by `MembershipOverviewPanel`
 * is derived here from the raw `MembershipOverview` snapshot so loading/error/
 * missing/empty/populated states stay consistent across mock and live transports
 * and the JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown
 * membership) and return zero-filled, render-safe values. Role labels/tones
 * reuse the canonical member-role order so this view cannot drift from the
 * workspace membership, user-profile and organization-overview breakdowns, and
 * project/comment labels match the other workspace views.
 */

import type { MembershipOverviewOptions } from "../../lib/membershipOverview";
import type {
  Comment,
  MemberRole,
  MembershipOverview,
  MembershipOverviewCounts,
  Project,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

const UNKNOWN_USER_LABEL = "Unknown user";
const UNKNOWN_ORG_LABEL = "Unknown organization";

/** Default and offered page bounds for the bounded recent lists (counts are never bounded). */
export const MEMBERSHIP_OVERVIEW_RECENT_LIMIT = 5;
export const MEMBERSHIP_OVERVIEW_RECENT_LIMITS: readonly number[] = [5, 10, 25];

/** Hook query options for the bounded recent projects/comments. */
export function buildMembershipOverviewOptions(
  recentLimit: number = MEMBERSHIP_OVERVIEW_RECENT_LIMIT,
): MembershipOverviewOptions {
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
  readonly key: keyof MembershipOverviewCounts;
  readonly label: string;
  readonly hint: string;
}[] = [
  { key: "projects", label: "Projects", hint: "Authored in this organization" },
  { key: "conversations", label: "Conversations", hint: "Started in this organization" },
  { key: "comments", label: "Comments", hint: "Authored in this organization" },
  { key: "presence", label: "Presence", hint: "Recorded sessions" },
];

/** Render-ready one whole-scope count card. */
export interface MembershipOverviewStat {
  readonly key: keyof MembershipOverviewCounts;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

/** Identity/context for the snapshot header. */
export interface MembershipOverviewIdentity {
  readonly displayName: string;
  readonly email: string;
  readonly avatarInitial: string;
  readonly shortId: string;
  readonly orgName: string;
  readonly orgSlug: string;
  readonly roleLabel: string;
  readonly roleTone: BadgeTone;
  readonly joinedLabel: string;
}

/** One recent authored project, projected into render-safe labels. */
export interface MembershipOverviewProjectRow {
  readonly key: string;
  readonly id: string;
  readonly name: string;
  readonly lifecycleLabel: string;
  readonly lifecycleTone: BadgeTone;
  readonly updatedLabel: string;
}

/** One recent authored comment, projected into render-safe labels. */
export interface MembershipOverviewCommentRow {
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
export function membershipOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function membershipOverviewGeneratedAtLabel(
  overview?: MembershipOverview | null,
  now: number = Date.now(),
): string {
  return membershipOverviewRelativeLabel(overview?.generated_at, now);
}

/** Short, human-friendly label for an id in a compact header. */
export function membershipOverviewShortId(id?: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Friendly display name, falling back to the email then a stable placeholder. */
export function membershipOverviewDisplayName(overview?: MembershipOverview | null): string {
  if (typeof overview?.display_name === "string" && overview.display_name.trim() !== "") {
    return overview.display_name;
  }
  if (typeof overview?.email === "string" && overview.email.trim() !== "") {
    return overview.email;
  }
  return UNKNOWN_USER_LABEL;
}

/** Single uppercase avatar initial derived from the display name. */
export function membershipOverviewAvatarInitial(overview?: MembershipOverview | null): string {
  return membershipOverviewDisplayName(overview).charAt(0).toUpperCase() || "?";
}

/** Organization display name with a stable fallback for missing/blank values. */
export function membershipOverviewOrgName(overview?: MembershipOverview | null): string {
  if (typeof overview?.org_name === "string" && overview.org_name.trim() !== "") {
    return overview.org_name;
  }
  return UNKNOWN_ORG_LABEL;
}

/** Role label/tone pair, with a stable fallback for unexpected roles. */
export function membershipOverviewRole(role?: MemberRole | null): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  const known = role && ROLE_ORDER.includes(role) ? role : null;
  return {
    label: known ? ROLE_LABEL[known] : (role ?? "Unknown"),
    tone: known ? ROLE_TONE[known] : "neutral",
  };
}

/** Identity/context labels for the snapshot header. */
export function membershipOverviewIdentity(
  overview?: MembershipOverview | null,
  now: number = Date.now(),
): MembershipOverviewIdentity {
  const role = membershipOverviewRole(overview?.role);
  return {
    displayName: membershipOverviewDisplayName(overview),
    email: typeof overview?.email === "string" ? overview.email : "",
    avatarInitial: membershipOverviewAvatarInitial(overview),
    shortId: membershipOverviewShortId(overview?.user_id),
    orgName: membershipOverviewOrgName(overview),
    orgSlug: typeof overview?.org_slug === "string" ? overview.org_slug : "",
    roleLabel: role.label,
    roleTone: role.tone,
    joinedLabel: membershipOverviewRelativeLabel(overview?.joined_at, now),
  };
}

/** One authoritative count, zero-filled for missing/malformed snapshots. */
export function membershipOverviewCount(
  overview?: MembershipOverview | null,
  key: keyof MembershipOverviewCounts = "projects",
): number {
  return nonNegativeCount(overview?.counts?.[key]);
}

/** All authoritative whole-scope counts, zero-filled in a stable shape. */
export function membershipOverviewCounts(
  overview?: MembershipOverview | null,
): MembershipOverviewCounts {
  return {
    projects: membershipOverviewCount(overview, "projects"),
    conversations: membershipOverviewCount(overview, "conversations"),
    comments: membershipOverviewCount(overview, "comments"),
    presence: membershipOverviewCount(overview, "presence"),
  };
}

/** The four headline counters, in a stable display order. */
export function membershipOverviewStatRows(
  overview?: MembershipOverview | null,
): MembershipOverviewStat[] {
  return COUNT_DEFS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    value: String(membershipOverviewCount(overview, key)),
  }));
}

/** Lifecycle badge for an archived/active project (matches the project views). */
export function membershipOverviewLifecycle(project?: Project | null): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  return project?.archived
    ? { label: "Archived", tone: "neutral" }
    : { label: "Active", tone: "success" };
}

/** Newest authored projects, projected into render-safe rows. */
export function membershipOverviewRecentProjects(
  overview?: MembershipOverview | null,
  now: number = Date.now(),
): MembershipOverviewProjectRow[] {
  return (overview?.recent_projects ?? []).map((project: Project, index: number) => {
    const lifecycle = membershipOverviewLifecycle(project);
    return {
      key: project?.id || `project-${index}`,
      id: typeof project?.id === "string" ? project.id : "",
      name:
        typeof project?.name === "string" && project.name.trim() !== ""
          ? project.name
          : "Unnamed project",
      lifecycleLabel: lifecycle.label,
      lifecycleTone: lifecycle.tone,
      updatedLabel: membershipOverviewRelativeLabel(project?.updated_at, now),
    };
  });
}

const COMMENT_PREVIEW_MAX = 120;

/** Whitespace-normalized, truncated single-line body preview. */
export function membershipOverviewCommentPreview(body?: string | null): string {
  const normalized = typeof body === "string" ? body.replace(/\s+/g, " ").trim() : "";
  if (normalized.length <= COMMENT_PREVIEW_MAX) return normalized;
  return `${normalized.slice(0, COMMENT_PREVIEW_MAX - 1).trimEnd()}…`;
}

/** Newest authored comments, projected into render-safe rows. */
export function membershipOverviewRecentComments(
  overview?: MembershipOverview | null,
  now: number = Date.now(),
): MembershipOverviewCommentRow[] {
  return (overview?.recent_comments ?? []).map((comment: Comment, index: number) => {
    const assetId = typeof comment?.asset_id === "string" ? comment.asset_id : "";
    const timestamp = typeof comment?.created_at === "string" ? comment.created_at : "";
    return {
      key: comment?.id || `comment-${index}`,
      id: typeof comment?.id === "string" ? comment.id : "",
      projectId: typeof comment?.project_id === "string" ? comment.project_id : "",
      assetId,
      bodyPreview: membershipOverviewCommentPreview(comment?.body),
      hasAsset: assetId !== "",
      timestamp,
      createdLabel: membershipOverviewRelativeLabel(timestamp, now),
    };
  });
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasMembershipOverviewData(overview?: MembershipOverview | null): boolean {
  if (!overview) return false;
  const counts = membershipOverviewCounts(overview);
  return (
    counts.projects > 0 ||
    counts.conversations > 0 ||
    counts.comments > 0 ||
    counts.presence > 0 ||
    (overview.recent_projects?.length ?? 0) > 0 ||
    (overview.recent_comments?.length ?? 0) > 0
  );
}

/** One-line summary for the panel footer. */
export function membershipOverviewSummaryLabel(overview?: MembershipOverview | null): string {
  if (!overview) return "";
  const counts = membershipOverviewCounts(overview);
  return [
    `${counts.projects} project${counts.projects === 1 ? "" : "s"}`,
    `${counts.comments} comment${counts.comments === 1 ? "" : "s"}`,
    membershipOverviewOrgName(overview),
  ].join(" · ");
}
