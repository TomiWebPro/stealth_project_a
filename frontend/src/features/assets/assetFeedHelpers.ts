/**
 * Display models for the authoritative asset feed (C137/C139/C140 follow-up).
 *
 * The backend derives the newest-first, workspace-wide feed fresh from the
 * authoritative `ASSETS` collection — the same store `/assets` and
 * `/assets/stats` read — and the mocks transport mirrors that derivation. This
 * module only turns the canonical `AssetFeed` payload into render-ready rows so
 * the panel JSX stays free of inline mapping and both transports render
 * identically. Every helper tolerates `undefined` (query not settled or failed)
 * and returns render-safe values.
 */

import type { AssetFeedOptions } from "../../lib/assetFeed";
import type { AssetFeed, AssetFeedItem, AssetStatus, AssetType } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { assetTypeTone, formatRelative } from "../home/format";
import {
  assetStatusLabel,
  assetStatusTone,
  assetTypeLabel,
  formatBytes,
} from "./assetStatsHelpers";

/** Render-ready row for one live asset in the feed. */
export interface AssetFeedRow {
  readonly id: string;
  readonly assetId: string;
  readonly assetName: string;
  readonly assetType: AssetType;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly projectId: string;
  readonly projectName: string;
  readonly status: AssetStatus;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly versionLabel: string;
  readonly sizeLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const ASSET_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Hook query options from the active project scope and page size. */
export function buildAssetFeedOptions(
  projectId: string | undefined,
  limit: number,
): AssetFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    limit,
  };
}

/** `vN` badge label for a current asset version (defensive for bad values). */
export function assetFeedVersionLabel(version: number): string {
  return Number.isInteger(version) && version >= 1 ? `v${version}` : "v?";
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by `(created_at, asset_id)`).
 */
export function assetFeedRows(
  feed: AssetFeed | undefined,
  now: number = Date.now(),
): readonly AssetFeedRow[] {
  const items: readonly AssetFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: item.asset_id,
    assetId: item.asset_id,
    assetName: item.name,
    assetType: item.type,
    typeLabel: assetTypeLabel(item.type),
    typeTone: assetTypeTone(item.type) ?? "neutral",
    projectId: item.project_id,
    projectName: item.project_name,
    status: item.status,
    statusLabel: assetStatusLabel(item.status),
    statusTone: assetStatusTone(item.status),
    versionLabel: assetFeedVersionLabel(item.version),
    sizeLabel: formatBytes(item.size_bytes),
    timestamp: item.created_at,
    relativeTime: formatRelative(item.created_at, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all live assets in scope before the `limit` page is applied.
 */
export function assetFeedSummary(rows: readonly AssetFeedRow[], total?: number): string {
  if (rows.length === 0) return "No assets";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} asset${count === 1 ? "" : "s"} · latest: ${latest?.assetName ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function assetFeedGeneratedAtLabel(
  feed: AssetFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope-aware empty-state copy for the feed. */
export function assetFeedEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Assets registered in this project will appear here."
    : "Assets will appear here as workspaces register them in the studio.";
}
