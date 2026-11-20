/**
 * Display models for the authoritative single asset-version overview (C250/C252/
 * C253 follow-up). Every value rendered by `VersionOverviewPanel` is derived here
 * from the raw `VersionOverview` snapshot so loading/error/missing/empty/
 * populated states stay consistent across mock and live transports and the JSX
 * stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown version)
 * and return zero-filled, render-safe values. The counter order mirrors the
 * canonical `VersionOverviewCounts` contract, and the version picker options are
 * derived from the authoritative `VersionFeed` rows already shown elsewhere so
 * this view cannot disagree with the version feed.
 */

import type {
  AssetVersion,
  VersionOverview,
  VersionOverviewCounts,
} from "../../lib/types";
import type { VersionOverviewOptions } from "../../lib/versionOverview";
import type { BadgeTone } from "../../ui/Badge";
import { assetTypeTone, formatRelative } from "../home/format";
import { assetTypeLabel, formatBytes } from "./assetStatsHelpers";
import type { VersionFeedRow } from "./versionFeedHelpers";

export interface VersionOverviewCountRow {
  readonly key: keyof VersionOverviewCounts;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface VersionOverviewIdentity {
  readonly assetName: string;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly versionLabel: string;
  readonly latestLabel: string;
  readonly latestTone: BadgeTone;
  readonly projectLabel: string;
  readonly createdLabel: string;
  readonly creatorLabel: string;
  readonly storageLabel: string;
  readonly contentTypeLabel: string;
}

export interface VersionOverviewSiblingRow {
  readonly id: string;
  readonly versionLabel: string;
  readonly bytesLabel: string;
  readonly creatorLabel: string;
  readonly relativeTime: string;
  readonly timestamp: string;
  readonly latest: boolean;
}

export interface VersionOverviewPickerOption {
  readonly value: string;
  readonly label: string;
  readonly assetId: string;
  readonly version: number;
}

/** Page bound used for the bounded sibling list (counts are never bounded). */
export const VERSION_OVERVIEW_RECENT_LIMIT = 5;

const COUNT_DEFS: readonly {
  readonly key: keyof VersionOverviewCounts;
  readonly label: string;
  readonly hint: string;
}[] = [
  { key: "asset_versions", label: "Versions", hint: "Recorded version records" },
  { key: "revisions", label: "Revisions", hint: "Versions v2 and newer" },
];

/** One whole-asset count, zero-filled when the snapshot is absent. */
export function versionOverviewCount(
  overview?: VersionOverview | null,
  key: keyof VersionOverviewCounts = "asset_versions",
): number {
  const value = overview?.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** `vN` badge label for a version, or an em dash when the value is missing/bad. */
export function versionOverviewVersionLabel(version?: number): string {
  return typeof version === "number" && Number.isInteger(version) && version >= 1
    ? `v${version}`
    : "—";
}

/** Short relative label for a timestamp, or "" when absent. */
export function versionOverviewRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function versionOverviewGeneratedAtLabel(
  overview?: VersionOverview | null,
  now: number = Date.now(),
): string {
  return versionOverviewRelativeLabel(overview?.generated_at, now);
}

/** Both whole-asset counters in a stable, zero-filled display order. */
export function versionOverviewCountRows(
  overview?: VersionOverview | null,
): VersionOverviewCountRow[] {
  return COUNT_DEFS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    value: String(versionOverviewCount(overview, key)),
  }));
}

/** Compact, render-safe label for an opaque id (uuids are abbreviated). */
export function versionOverviewActorLabel(value?: string | null): string {
  if (!value) return "—";
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

/** Identity badges, storage reference and recency for the snapshot header. */
export function versionOverviewIdentity(
  overview?: VersionOverview | null,
  now: number = Date.now(),
): VersionOverviewIdentity {
  const latest = overview?.is_latest === true;
  return {
    assetName: overview?.asset_name || "—",
    typeLabel: overview ? assetTypeLabel(overview.asset_type) : "—",
    typeTone: overview ? assetTypeTone(overview.asset_type) : "neutral",
    versionLabel: versionOverviewVersionLabel(overview?.version),
    latestLabel: latest ? "Latest" : "Earlier",
    latestTone: latest ? "success" : "neutral",
    projectLabel: overview?.project_name || "",
    createdLabel: versionOverviewRelativeLabel(overview?.created_at, now),
    creatorLabel: versionOverviewActorLabel(overview?.created_by),
    storageLabel: formatBytes(overview?.storage?.size_bytes),
    contentTypeLabel: overview?.storage?.content_type || "",
  };
}

/** Bounded newest-first sibling versions projected into render-safe display rows. */
export function versionOverviewRecentVersions(
  overview?: VersionOverview | null,
  now: number = Date.now(),
): VersionOverviewSiblingRow[] {
  return (overview?.recent_versions ?? []).map((version: AssetVersion) => ({
    id: `${version.asset_id}:${version.version}`,
    versionLabel: versionOverviewVersionLabel(version.version),
    bytesLabel: formatBytes(version.storage?.size_bytes),
    creatorLabel: versionOverviewActorLabel(version.created_by),
    relativeTime: versionOverviewRelativeLabel(version.created_at, now),
    timestamp: version.created_at,
    latest: typeof overview?.version === "number" && version.version === overview.version,
  }));
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasVersionOverviewData(overview?: VersionOverview | null): boolean {
  if (!overview) return false;
  return (
    versionOverviewCount(overview, "asset_versions") > 0 ||
    versionOverviewCount(overview, "revisions") > 0 ||
    (overview.recent_versions?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function versionOverviewSummaryLabel(overview?: VersionOverview | null): string {
  if (!overview) return "";
  return [
    `${versionOverviewCount(overview, "asset_versions")} versions`,
    `${versionOverviewCount(overview, "revisions")} revisions`,
    `viewing ${versionOverviewVersionLabel(overview.version)}`,
  ].join(" · ");
}

/** Filter-aware empty-state copy for the picker/feed. */
export function versionOverviewEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Version records for assets in this project will appear here."
    : "Asset version records will appear here as assets are registered and revised.";
}

/**
 * Picker options derived from the authoritative version-feed rows. The value
 * encodes both ids so a single selection resolves the `(assetId, version)` pair
 * the overview hook needs without a separate lookup.
 */
export function versionOverviewPickerOptions(
  rows: readonly VersionFeedRow[],
): VersionOverviewPickerOption[] {
  return rows.map((row) => ({
    value: `${row.assetId}:${row.version}`,
    label: `${row.assetName} · ${row.versionLabel}`,
    assetId: row.assetId,
    version: row.version,
  }));
}

/** Resolve the active picker option, falling back to the first available row. */
export function versionOverviewActiveOption(
  options: readonly VersionOverviewPickerOption[],
  selectedValue: string,
): VersionOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}

/** Hook query options for the bounded sibling list. */
export function buildVersionOverviewOptions(
  recentLimit: number = VERSION_OVERVIEW_RECENT_LIMIT,
): VersionOverviewOptions {
  return { recentLimit };
}
