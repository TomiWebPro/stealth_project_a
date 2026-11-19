/**
 * Display models for the authoritative asset lineage feed (C157/C159/C160
 * follow-up). The backend derives the newest-first, workspace-wide feed of typed
 * asset relationships fresh from the authoritative `ASSET_RELATIONSHIPS`
 * collection — the same store `/lineage/stats` aggregates — and the mocks
 * transport mirrors that derivation. This module only turns the canonical
 * `LineageFeed` payload into render-ready rows so the panel JSX stays free of
 * inline mapping and both transports render identically. Every helper tolerates
 * `undefined` (query not settled or failed) and returns render-safe values.
 */

import type { LineageFeedOptions } from "../../lib/lineageFeed";
import type { LineageFeed, LineageFeedItem } from "../../lib/types";
import type { RelationshipType } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { lineageTypeLabel, lineageTypeTone } from "./lineageStatsHelpers";

/** Stable display name the backend uses when a relationship's target is missing. */
const UNKNOWN_ASSET_LABEL = "Unknown asset";
/** Stable display name the backend uses when a relationship's project is missing. */
const UNKNOWN_PROJECT_LABEL = "Unknown project";

/** Render-ready row for one typed asset relationship in the feed. */
export interface LineageFeedRow {
  readonly id: string;
  readonly fromAssetId: string;
  readonly fromAssetName: string;
  readonly toAssetId: string;
  readonly toAssetName: string;
  readonly hasTarget: boolean;
  readonly projectId: string;
  readonly projectName: string;
  readonly type: RelationshipType;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const LINEAGE_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Hook query options from the active project scope and page size. */
export function buildLineageFeedOptions(
  projectId: string | undefined,
  limit: number,
): LineageFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    limit,
  };
}

/**
 * True when a relationship's target resolves to a live asset. The backend keeps
 * links with a soft-deleted/unknown target but labels them with the stable
 * "Unknown asset" sentinel; those rows cannot offer a target deep link.
 */
export function lineageTargetKnown(name: string): boolean {
  return typeof name === "string" && name.trim() !== "" && name !== UNKNOWN_ASSET_LABEL;
}

/** Render-safe display name, falling back to the backend's stable sentinel. */
function displayName(value: string, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/** Map a canonical feed to render-ready rows (already newest-first on the wire). */
export function lineageFeedRows(
  feed: LineageFeed | undefined,
  now: number = Date.now(),
): readonly LineageFeedRow[] {
  const items: readonly LineageFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: item.id,
    fromAssetId: item.from_asset_id,
    fromAssetName: displayName(item.from_asset_name, UNKNOWN_ASSET_LABEL),
    toAssetId: item.to_asset_id,
    toAssetName: displayName(item.to_asset_name, UNKNOWN_ASSET_LABEL),
    hasTarget: lineageTargetKnown(item.to_asset_name),
    projectId: item.project_id,
    projectName: displayName(item.project_name, UNKNOWN_PROJECT_LABEL),
    type: item.type,
    typeLabel: lineageTypeLabel(item.type),
    typeTone: lineageTypeTone(item.type),
    timestamp: item.created_at,
    relativeTime: formatRelative(item.created_at, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all relationships in scope before the `limit` page is applied.
 */
export function lineageFeedSummary(rows: readonly LineageFeedRow[], total?: number): string {
  if (rows.length === 0) return "No relationships";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} relationships · latest: ${latest?.fromAssetName ?? "—"} → ${
    latest?.toAssetName ?? "—"
  }`;
}

/** Compact "generated at" label for the feed footer. */
export function lineageFeedGeneratedAtLabel(
  feed: LineageFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Filter-aware empty-state copy for the feed. */
export function lineageFeedEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Asset relationships between assets in this project will appear here."
    : "Typed asset relationships will appear here as assets are derived and linked.";
}
