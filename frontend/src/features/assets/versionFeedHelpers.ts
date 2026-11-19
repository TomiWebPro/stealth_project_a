/**
 * Display models for the authoritative asset version feed (C153/C155/C156
 * follow-up).
 *
 * The backend derives the newest-first, workspace-wide feed of asset versions
 * fresh from the authoritative `ASSET_VERSIONS` collection — the same store the
 * version statistics snapshot aggregates — and the mocks transport mirrors that
 * derivation. This module only turns the canonical `VersionFeed` payload into
 * render-ready rows so the panel JSX stays free of inline mapping and both
 * transports render identically. Every helper tolerates `undefined` (query not
 * settled or failed) and returns render-safe values.
 */

import type { VersionFeedOptions } from "../../lib/versionFeed";
import type { AssetType, VersionFeed, VersionFeedItem } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { assetTypeTone, formatRelative } from "../home/format";

/** Render-ready row for one asset version in the feed. */
export interface VersionFeedRow {
  readonly id: string;
  readonly assetId: string;
  readonly assetName: string;
  readonly assetType: AssetType;
  readonly typeTone: BadgeTone;
  readonly projectId: string;
  readonly projectName: string;
  readonly version: number;
  readonly versionLabel: string;
  readonly creatorId: string;
  readonly creatorLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const VERSION_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Hook query options from the active project scope and page size. */
export function buildVersionFeedOptions(
  projectId: string | undefined,
  limit: number,
): VersionFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    limit,
  };
}

/** `vN` badge label for a version number, defensive against bad wire values. */
export function versionFeedVersionLabel(version: number): string {
  return Number.isInteger(version) && version >= 1 ? `v${version}` : "v?";
}

/** Compact, render-safe label for an opaque entity id. */
export function versionFeedShortIdLabel(value: string, prefix: string): string {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean) return prefix;
  return clean.length > 8 ? `${prefix} ${clean.slice(0, 8)}…` : `${prefix} ${clean}`;
}

/** Map a canonical feed to render-ready rows (already newest-first on the wire). */
export function versionFeedRows(
  feed: VersionFeed | undefined,
  now: number = Date.now(),
): readonly VersionFeedRow[] {
  const items: readonly VersionFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: `${item.asset_id}:${item.version}`,
    assetId: item.asset_id,
    assetName: item.asset_name,
    assetType: item.asset_type,
    typeTone: assetTypeTone(item.asset_type) ?? "neutral",
    projectId: item.project_id,
    projectName: item.project_name,
    version: item.version,
    versionLabel: versionFeedVersionLabel(item.version),
    creatorId: item.created_by,
    creatorLabel: versionFeedShortIdLabel(item.created_by, "By"),
    timestamp: item.created_at,
    relativeTime: formatRelative(item.created_at, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all version records in scope before the `limit` page is applied.
 */
export function versionFeedSummary(rows: readonly VersionFeedRow[], total?: number): string {
  if (rows.length === 0) return "No asset versions";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} versions · latest: ${latest?.assetName ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function versionFeedGeneratedAtLabel(
  feed: VersionFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Filter-aware empty-state copy for the feed. */
export function versionFeedEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Version records for assets in this project will appear here."
    : "Asset version records will appear here as assets are registered and revised.";
}
