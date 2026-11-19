/**
 * Display models for the authoritative organization/membership statistics
 * (C69/C71/C72 follow-up). Every value rendered by `OrganizationStatsPanel` is
 * derived here from the raw `OrganizationStats` payload so empty, partial and
 * populated states stay consistent across mock and live transports and JSX stays
 * free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The role order mirrors the canonical
 * `MEMBER_ROLES` in `lib/organizationStats` so the UI always shows a complete
 * zero-filled breakdown.
 */

import type { MemberRole, OrganizationStats } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface OrganizationStatsStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface OrganizationRoleRow {
  readonly role: MemberRole;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all members in scope, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface OrganizationMemberRow {
  readonly orgId: string;
  readonly label: string;
  readonly count: number;
  readonly percent: number;
  readonly fraction: number;
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function organizationStatsRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Format a derived per-organization average without noisy trailing zeros. */
export function formatOrganizationAverage(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value < 0) return "—";
  return String(Math.round(value * 1000) / 1000);
}

/** Short, stable label for an organization id when no friendly name is known. */
export function shortOrganizationId(orgId: string): string {
  return orgId.length > 8 ? `${orgId.slice(0, 8)}…` : orgId;
}

/** The three authoritative workspace counters plus newest-organization recency. */
export function organizationStatsCards(
  stats?: OrganizationStats,
  now: number = Date.now(),
): OrganizationStatsStat[] {
  return [
    {
      key: "organizations",
      label: "Organizations",
      value: String(stats?.total_organizations ?? 0),
      hint: "In this scope",
    },
    {
      key: "members",
      label: "Members",
      value: String(stats?.total_members ?? 0),
      hint: "Across organizations",
    },
    {
      key: "users",
      label: "Users",
      value: String(stats?.total_users ?? 0),
      hint: "Registered accounts",
    },
    {
      key: "newest",
      label: "Newest org",
      value: organizationStatsRelativeLabel(stats?.newest_org_at, now) || "—",
      hint: "Last created",
    },
  ];
}

/** Zero-filled membership-role distribution with a share per role. */
export function organizationRoleRows(stats?: OrganizationStats): OrganizationRoleRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_role ?? []) {
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

/**
 * Per-organization member counts with a share of all scoped members. Rows keep
 * the backend's deterministic (descending count, then id) order; friendly names
 * are resolved through `orgNames` and fall back to a short id.
 */
export function organizationMemberRows(
  stats?: OrganizationStats,
  orgNames: Readonly<Record<string, string>> = {},
): OrganizationMemberRow[] {
  const total = stats?.total_members ?? 0;
  return [...(stats?.by_organization ?? [])]
    .filter((entry) => entry && Number.isFinite(entry.members))
    .sort((a, b) => b.members - a.members || a.org_id.localeCompare(b.org_id))
    .map((entry) => {
      const fraction = clamp01(total > 0 ? entry.members / total : 0);
      return {
        orgId: entry.org_id,
        label: orgNames[entry.org_id] || shortOrganizationId(entry.org_id),
        count: entry.members,
        fraction,
        percent: Math.round(fraction * 100),
      };
    });
}

/** Mean members per organization, render-safe when absent. */
export function organizationAverageLabel(stats?: OrganizationStats): string {
  return formatOrganizationAverage(stats?.average_members_per_org);
}

/** True when the snapshot carries at least one org, member or user. */
export function hasOrganizationStatsData(stats?: OrganizationStats): boolean {
  if (!stats) return false;
  return stats.total_organizations > 0 || stats.total_members > 0 || stats.total_users > 0;
}

/** Compact relative "generated at" label for the snapshot footer. */
export function organizationStatsGeneratedAtLabel(
  stats?: OrganizationStats,
  now: number = Date.now(),
): string {
  return organizationStatsRelativeLabel(stats?.generated_at, now);
}
