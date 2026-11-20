/**
 * Display models for the authoritative single publish-receipt overview (C278/
 * C280/C281 follow-up). The backend derives the whole snapshot fresh from the
 * authoritative `ASSETS` store — the same store `/publishes` projects and
 * `/publishes/stats` aggregates — and the mocks transport mirrors that
 * derivation. This module only turns the canonical `PublishOverview` payload and
 * the publish feed (used to populate the picker) into render-ready values so
 * `PublishOverviewPanel` stays free of inline mapping and both transports render
 * identically.
 *
 * Every helper tolerates `undefined` (query not settled / failed / unknown
 * publication) and returns render-safe, zero-filled values. Asset-type labels/
 * tones, byte sizes and `vN` labels reuse the canonical publish helpers so the
 * overview cannot drift from the publish feed, stats or detail screens.
 */

import type { PublishFeedOptions } from "../../lib/publishFeed";
import type { PublishOverviewOptions } from "../../lib/publishOverview";
import type {
  AssetType,
  PublishFeedItem,
  PublishOverview,
  PublishOverviewCounts,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { assetTypeTone, formatRelative } from "../home/format";
import { assetTypeLabel } from "./assetStatsHelpers";
import { buildPublishFeedOptions, type PublishFeedRow } from "./publishFeedHelpers";
import { formatByteSize, publishVersionLabel } from "./publishStatsHelpers";

export interface PublishOverviewCountRow {
  readonly key: keyof PublishOverviewCounts;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface PublishOverviewIdentity {
  readonly assetName: string;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly versionLabel: string;
  readonly sizeLabel: string;
  readonly publishedLabel: string;
  readonly projectLabel: string;
}

export interface PublishOverviewSiblingRow {
  readonly id: string;
  readonly assetName: string;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly versionLabel: string;
  readonly sizeLabel: string;
  readonly relativeTime: string;
  readonly timestamp: string;
  readonly selected: boolean;
}

export interface PublishOverviewPickerOption {
  readonly value: string;
  readonly label: string;
  readonly assetId: string;
  readonly projectId: string;
}

/** Page size used to populate the publication picker from the authoritative feed. */
export const PUBLISH_OVERVIEW_PICKER_LIMIT = 25;

/** Default bounded recent-sibling page size. */
export const PUBLISH_OVERVIEW_DEFAULT_RECENT_LIMIT = 5;

/** Recent-sibling page-size chips offered above the overview. */
export const PUBLISH_OVERVIEW_RECENT_LIMITS: readonly number[] = [
  PUBLISH_OVERVIEW_DEFAULT_RECENT_LIMIT,
  10,
  25,
];

const COUNT_DEFS: readonly {
  readonly key: keyof PublishOverviewCounts;
  readonly label: string;
  readonly hint: string;
}[] = [
  { key: "project_published", label: "Project publishes", hint: "Published assets in this project" },
  { key: "project_bytes", label: "Project bytes", hint: "Bytes delivered in this project" },
  { key: "total_published", label: "Workspace total", hint: "Published assets across the workspace" },
];

/** Hook options for the bounded recent-sibling projection. */
export function buildPublishOverviewOptions(
  recentLimit: number = PUBLISH_OVERVIEW_DEFAULT_RECENT_LIMIT,
): PublishOverviewOptions {
  return { recentLimit };
}

/** Feed options used to populate the publication picker, optionally project-scoped. */
export function buildPublishPickerFeedOptions(projectId?: string): PublishFeedOptions {
  return buildPublishFeedOptions(projectId, PUBLISH_OVERVIEW_PICKER_LIMIT);
}

/** One whole-scope count, zero-filled when the snapshot is absent or malformed. */
export function publishOverviewCount(
  overview?: PublishOverview | null,
  key: keyof PublishOverviewCounts = "total_published",
): number {
  const value = overview?.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** `vN` badge label for a publish receipt version, or an em dash when missing/bad. */
export function publishOverviewVersionLabel(version?: number): string {
  return typeof version === "number" && Number.isInteger(version) && version >= 1
    ? publishVersionLabel(version)
    : "—";
}

/** Short relative label for a timestamp, or "" when absent. */
export function publishOverviewRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function publishOverviewGeneratedAtLabel(
  overview?: PublishOverview | null,
  now: number = Date.now(),
): string {
  return publishOverviewRelativeLabel(overview?.generated_at, now);
}

/** The three whole-scope publish counters in a stable, zero-filled display order. */
export function publishOverviewCountRows(
  overview?: PublishOverview | null,
): PublishOverviewCountRow[] {
  return COUNT_DEFS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    value:
      key === "project_bytes"
        ? formatByteSize(publishOverviewCount(overview, key))
        : String(publishOverviewCount(overview, key)),
  }));
}

/** Identity badges, delivered bytes and recency for the snapshot header. */
export function publishOverviewIdentity(
  overview?: PublishOverview | null,
  now: number = Date.now(),
): PublishOverviewIdentity {
  const type: AssetType | undefined = overview?.asset_type;
  return {
    assetName: overview?.asset_name || "—",
    typeLabel: type ? assetTypeLabel(type) : "—",
    typeTone: type ? assetTypeTone(type) ?? "neutral" : "neutral",
    versionLabel: publishOverviewVersionLabel(overview?.version),
    sizeLabel: formatByteSize(overview?.size_bytes),
    publishedLabel: publishOverviewRelativeLabel(overview?.published_at, now) || "—",
    projectLabel: overview?.project_name || "",
  };
}

/** Bounded newest-first same-project siblings projected into render-safe rows. */
export function publishOverviewRecentSiblings(
  overview?: PublishOverview | null,
  now: number = Date.now(),
): PublishOverviewSiblingRow[] {
  return (overview?.recent_siblings ?? []).map((item: PublishFeedItem) => ({
    id: item.asset_id,
    assetName: item.asset_name,
    typeLabel: assetTypeLabel(item.asset_type),
    typeTone: assetTypeTone(item.asset_type) ?? "neutral",
    versionLabel: publishOverviewVersionLabel(item.version),
    sizeLabel: formatByteSize(item.size_bytes),
    relativeTime: publishOverviewRelativeLabel(item.published_at, now),
    timestamp: item.published_at,
    selected: item.asset_id === overview?.asset_id,
  }));
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasPublishOverviewData(overview?: PublishOverview | null): boolean {
  if (!overview) return false;
  return (
    publishOverviewCount(overview, "project_published") > 0 ||
    publishOverviewCount(overview, "project_bytes") > 0 ||
    publishOverviewCount(overview, "total_published") > 0 ||
    (overview.recent_siblings?.length ?? 0) > 0
  );
}

/** One-line summary for the panel footer. */
export function publishOverviewSummaryLabel(overview?: PublishOverview | null): string {
  if (!overview) return "";
  return [
    `${publishOverviewCount(overview, "project_published")} in this project`,
    `${publishOverviewCount(overview, "total_published")} workspace-wide`,
    `viewing ${publishOverviewVersionLabel(overview.version)}`,
  ].join(" · ");
}

/** Filter-aware empty-state copy for the picker/feed. */
export function publishOverviewEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Published deliverables for assets in this project will appear here."
    : "Published deliverables will appear here as assets receive publish receipts.";
}

/**
 * Picker options derived from the authoritative publish-feed rows already shown
 * elsewhere, so this view cannot disagree with the feed. The value is the asset
 * id, which is exactly what the overview hook needs.
 */
export function publishOverviewPickerOptions(
  rows: readonly PublishFeedRow[],
): PublishOverviewPickerOption[] {
  return rows.map((row) => ({
    value: row.assetId,
    label: `${row.assetName} · ${row.versionLabel} · ${row.projectName}`,
    assetId: row.assetId,
    projectId: row.projectId,
  }));
}

/** Resolve the active picker option, falling back to the first available row. */
export function publishOverviewActiveOption(
  options: readonly PublishOverviewPickerOption[],
  selectedValue: string,
): PublishOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}
