/**
 * Display models for the authoritative organization feed (C161/C163/C164
 * follow-up). The backend derives the newest-first, workspace-wide feed of
 * organizations fresh from the authoritative `ORGANIZATIONS` store, joining
 * member and project activity counts; the mocks transport mirrors that
 * derivation. This module only turns the canonical `OrganizationFeed` payload
 * into render-ready rows, keeping the panel JSX free of inline mapping and both
 * transports visually identical. Every helper tolerates `undefined` (query not
 * settled or failed) and returns render-safe values.
 */

import type { OrganizationFeedOptions } from "../../lib/organizationFeed";
import type { OrganizationFeed, OrganizationFeedItem } from "../../lib/types";
import { formatRelative } from "../home/format";

/** Render-ready row for one organization in the feed. */
export interface OrganizationFeedRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly memberLabel: string;
  readonly projectLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const ORGANIZATION_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Hook query options from the selected page size. */
export function buildOrganizationFeedOptions(limit: number): OrganizationFeedOptions {
  return { limit };
}

/** Compact, stable fallback for an organization with no usable name or slug. */
export function shortOrganizationFeedId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Display name preferring the friendly name, then the slug, then a short id. */
export function organizationFeedDisplayName(item: OrganizationFeedItem): string {
  if (typeof item.name === "string" && item.name.trim() !== "") return item.name;
  if (typeof item.slug === "string" && item.slug.trim() !== "") return item.slug;
  return shortOrganizationFeedId(item.org_id);
}

/** Render-safe joined count label with correct singular/plural wording. */
export function organizationFeedCountLabel(count: number, noun: string): string {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `${safe} ${safe === 1 ? noun : `${noun}s`}`;
}

/** Map a canonical feed to render-ready rows (already newest-first on the wire). */
export function organizationFeedRows(
  feed: OrganizationFeed | undefined,
  now: number = Date.now(),
): readonly OrganizationFeedRow[] {
  const items: readonly OrganizationFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: item.org_id,
    name: organizationFeedDisplayName(item),
    slug: typeof item.slug === "string" && item.slug.trim() !== "" ? item.slug : "—",
    memberLabel: organizationFeedCountLabel(item.member_count, "member"),
    projectLabel: organizationFeedCountLabel(item.project_count, "project"),
    timestamp: item.created_at,
    relativeTime: formatRelative(item.created_at, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all organizations in scope before the `limit` page is applied.
 */
export function organizationFeedSummary(rows: readonly OrganizationFeedRow[], total?: number): string {
  if (rows.length === 0) return "No organizations";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${organizationFeedCountLabel(count, "organization")} · latest: ${
    latest?.name ?? "—"
  }`;
}

/** Compact "generated at" label for the feed footer. */
export function organizationFeedGeneratedAtLabel(
  feed: OrganizationFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Empty-state copy for a workspace with no organizations. */
export function organizationFeedEmptyDescription(): string {
  return "Organizations will appear here as shared team spaces are created.";
}
