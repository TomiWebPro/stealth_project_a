/**
 * Display models for the authoritative single-organization overview
 * (C226/C228/C229 follow-up). Every value rendered by
 * `OrganizationOverviewPanel` is derived here from the raw
 * `OrganizationOverview` snapshot so loading/error/missing/empty/populated
 * states stay consistent across mock and live transports and the JSX stays free
 * of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown
 * organization) and return zero-filled, render-safe values. Role labels/tones
 * reuse the canonical `MEMBER_ROLES` order so this view can never drift from the
 * workspace-wide organization stats breakdown.
 */

import type {
  Member,
  MemberRole,
  Organization,
  OrganizationOverview,
  Project,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface OrganizationOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface OrganizationRoleRow {
  readonly role: MemberRole;
  readonly label: string;
  readonly count: number;
  readonly percent: number;
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface OrganizationMemberRow {
  readonly key: string;
  readonly label: string;
  readonly email: string;
  readonly roleLabel: string;
  readonly roleTone: BadgeTone;
  readonly joinedLabel: string;
}

export interface OrganizationProjectRow {
  readonly key: string;
  readonly id: string;
  readonly name: string;
  readonly lifecycleLabel: string;
  readonly lifecycleTone: BadgeTone;
  readonly createdLabel: string;
  readonly updatedLabel: string;
}

export interface OrganizationOverviewIdentity {
  readonly nameLabel: string;
  readonly slugLabel: string;
  readonly shortIdLabel: string;
  readonly createdLabel: string;
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

function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or "" when absent. */
export function organizationOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function organizationOverviewGeneratedAtLabel(
  overview?: OrganizationOverview | null,
  now: number = Date.now(),
): string {
  return organizationOverviewRelativeLabel(overview?.generated_at, now);
}

/** Short, human-friendly label for an organization id in a compact header. */
export function organizationOverviewShortId(orgId?: string | null): string {
  if (!orgId) return "—";
  return orgId.length > 8 ? `${orgId.slice(0, 8)}…` : orgId;
}

/** Friendly org name, falling back to the slug then a stable placeholder. */
export function organizationOverviewName(overview?: OrganizationOverview | null): string {
  if (typeof overview?.name === "string" && overview.name.trim() !== "") {
    return overview.name;
  }
  if (typeof overview?.slug === "string" && overview.slug.trim() !== "") {
    return overview.slug;
  }
  return "Unknown organization";
}

/** Picker option label for one organization. */
export function organizationOverviewOptionLabel(org: Organization): string {
  const name = typeof org.name === "string" && org.name.trim() !== "" ? org.name : "Unnamed organization";
  const slug = typeof org.slug === "string" && org.slug.trim() !== "" ? `@${org.slug}` : "";
  return slug ? `${name} · ${slug}` : name;
}

/** Identity labels for the snapshot header. */
export function organizationOverviewIdentity(
  overview?: OrganizationOverview | null,
  now: number = Date.now(),
): OrganizationOverviewIdentity {
  return {
    nameLabel: organizationOverviewName(overview),
    slugLabel:
      typeof overview?.slug === "string" && overview.slug.trim() !== ""
        ? `@${overview.slug}`
        : "—",
    shortIdLabel: organizationOverviewShortId(overview?.org_id),
    createdLabel: organizationOverviewRelativeLabel(overview?.created_at, now),
  };
}

/** Authoritative whole-scope counts, zero-filled for missing/malformed snapshots. */
export function organizationOverviewCounts(overview?: OrganizationOverview | null) {
  const counts = overview?.counts;
  return {
    members: nonNegativeCount(counts?.members),
    projects: nonNegativeCount(counts?.projects),
  };
}

/** Zero-filled membership-role distribution with a share per role. */
export function organizationOverviewRoleRows(
  overview?: OrganizationOverview | null,
): OrganizationRoleRow[] {
  const counts = new Map<string, number>();
  for (const entry of overview?.by_role ?? []) {
    if (entry && Number.isFinite(entry.members)) counts.set(entry.role, entry.members);
  }
  const total = ROLE_ORDER.reduce((sum, role) => sum + (counts.get(role) ?? 0), 0);
  return ROLE_ORDER.map((role) => {
    const count = counts.get(role) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      role,
      label: ROLE_LABEL[role] ?? role,
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: ROLE_TONE[role] ?? "neutral",
    };
  });
}

/** Number of role buckets that hold at least one member. */
export function organizationOverviewActiveRoleCount(
  overview?: OrganizationOverview | null,
): number {
  return organizationOverviewRoleRows(overview).filter((row) => row.count > 0).length;
}

/** The four headline counters, in a stable display order. */
export function organizationOverviewStatRows(
  overview?: OrganizationOverview | null,
  now: number = Date.now(),
): OrganizationOverviewStat[] {
  const counts = organizationOverviewCounts(overview);
  return [
    {
      key: "members",
      label: "Members",
      value: String(counts.members),
      hint: "In this organization",
    },
    {
      key: "projects",
      label: "Projects",
      value: String(counts.projects),
      hint: "Owned by this organization",
    },
    {
      key: "roles",
      label: "Active roles",
      value: String(organizationOverviewActiveRoleCount(overview)),
      hint: "Roles with members",
    },
    {
      key: "created",
      label: "Created",
      value: organizationOverviewRelativeLabel(overview?.created_at, now) || "—",
      hint: "Organization age",
    },
  ];
}

/** Newest members projected into render-safe rows. */
export function organizationOverviewRecentMembers(
  overview?: OrganizationOverview | null,
  now: number = Date.now(),
): OrganizationMemberRow[] {
  return (overview?.recent_members ?? []).map((member: Member, index: number) => {
    const role = member?.role;
    const label =
      typeof member?.display_name === "string" && member.display_name.trim() !== ""
        ? member.display_name
        : typeof member?.email === "string" && member.email.trim() !== ""
          ? member.email
          : "Unknown member";
    return {
      key: member?.user_id || `member-${index}`,
      label,
      email: typeof member?.email === "string" ? member.email : "",
      roleLabel: role ? (ROLE_LABEL[role] ?? role) : "Unknown",
      roleTone: role ? (ROLE_TONE[role] ?? "neutral") : "neutral",
      joinedLabel: organizationOverviewRelativeLabel(member?.joined_at, now),
    };
  });
}

/** Lifecycle badge for an archived/active project. */
export function organizationOverviewLifecycle(project?: Project | null): {
  readonly label: string;
  readonly tone: BadgeTone;
} {
  return project?.archived
    ? { label: "Archived", tone: "neutral" }
    : { label: "Active", tone: "success" };
}

/** Newest projects projected into render-safe rows. */
export function organizationOverviewRecentProjects(
  overview?: OrganizationOverview | null,
  now: number = Date.now(),
): OrganizationProjectRow[] {
  const lifecycle = organizationOverviewLifecycle;
  return (overview?.recent_projects ?? []).map((project: Project, index: number) => {
    const state = lifecycle(project);
    const name =
      typeof project?.name === "string" && project.name.trim() !== ""
        ? project.name
        : "Unnamed project";
    return {
      key: project?.id || `project-${index}`,
      id: typeof project?.id === "string" ? project.id : "",
      name,
      lifecycleLabel: state.label,
      lifecycleTone: state.tone,
      createdLabel: organizationOverviewRelativeLabel(project?.created_at, now),
      updatedLabel: organizationOverviewRelativeLabel(project?.updated_at, now),
    };
  });
}

/** False only when the snapshot is missing or carries no activity at all. */
export function hasOrganizationOverviewData(overview?: OrganizationOverview | null): boolean {
  if (!overview) return false;
  const counts = organizationOverviewCounts(overview);
  return (
    counts.members > 0 ||
    counts.projects > 0 ||
    (overview.recent_members?.length ?? 0) > 0 ||
    (overview.recent_projects?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function organizationOverviewSummaryLabel(
  overview?: OrganizationOverview | null,
): string {
  if (!overview) return "";
  const counts = organizationOverviewCounts(overview);
  const memberWord = counts.members === 1 ? "member" : "members";
  const projectWord = counts.projects === 1 ? "project" : "projects";
  return `${counts.members} ${memberWord} · ${counts.projects} ${projectWord}`;
}
