/**
 * Display models for the authoritative publish feed (C125/C127/C128 follow-up).
 *
 * The backend derives the newest-first feed of published deliverables fresh
 * from live assets' `publish_receipt` records, and the mocks transport mirrors
 * that derivation. This module only turns the canonical `PublishFeed` payload
 * into render-ready rows so the panel JSX stays free of inline mapping and both
 * transports render identically. Every helper tolerates `undefined` (query not
 * settled or failed) and returns render-safe values.
 */

import type { PublishFeedOptions } from "../../lib/publishFeed";
import type { AssetType, PublishFeed, PublishFeedItem } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { assetTypeTone, formatRelative } from "../home/format";
import { formatByteSize, publishVersionLabel } from "./publishStatsHelpers";

/** Render-ready row for one published deliverable. */
export interface PublishFeedRow {
  readonly id: string;
  readonly assetId: string;
  readonly assetName: string;
  readonly assetType: AssetType;
  readonly typeTone: BadgeTone;
  readonly projectId: string;
  readonly projectName: string;
  readonly versionLabel: string;
  readonly sizeLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const PUBLISH_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Hook query options from the active project scope and page size. */
export function buildPublishFeedOptions(
  projectId: string | undefined,
  limit: number,
): PublishFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    limit,
  };
}

/** `vN` badge label for a publish receipt version (defensive for bad values). */
export function publishFeedVersionLabel(version: number): string {
  return Number.isInteger(version) && version >= 1 ? publishVersionLabel(version) : "v?";
}

/** Map a canonical feed payload to render-ready rows (already newest-first). */
export function publishFeedRows(
  feed: PublishFeed | undefined,
  now: number = Date.now(),
): readonly PublishFeedRow[] {
  const items: readonly PublishFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: item.asset_id,
    assetId: item.asset_id,
    assetName: item.asset_name,
    assetType: item.asset_type,
    typeTone: assetTypeTone(item.asset_type) ?? "neutral",
    projectId: item.project_id,
    projectName: item.project_name,
    versionLabel: publishFeedVersionLabel(item.version),
    sizeLabel: formatByteSize(item.size_bytes),
    timestamp: item.published_at,
    relativeTime: formatRelative(item.published_at, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all publishes in scope before the `limit` page is applied.
 */
export function publishFeedSummary(
  rows: readonly PublishFeedRow[],
  total?: number,
): string {
  if (rows.length === 0) return "No published deliverables";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} published · latest: ${latest?.assetName ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function publishFeedGeneratedAtLabel(
  feed: PublishFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Filter-aware empty-state copy for the feed. */
export function publishFeedEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Publish receipts for assets in this project will appear here."
    : "Publish receipts will appear here as assets are published to the Publish folder.";
}
