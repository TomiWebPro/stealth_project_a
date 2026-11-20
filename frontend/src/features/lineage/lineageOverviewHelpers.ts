/**
 * Display models for the authoritative single lineage-relationship overview
 * (C258/C260/C261 follow-up). Every value rendered by `LineageOverviewPanel` is
 * derived here from the raw `LineageOverview` snapshot so loading/error/missing/
 * empty/populated states stay consistent across mock and live transports and the
 * JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown link) and
 * return zero-filled, render-safe values. The picker options are derived from the
 * authoritative lineage-feed rows already shown elsewhere so this view cannot
 * disagree with the lineage feed. Relationship type/asset type labels and tones
 * reuse the canonical helpers so the view cannot drift from the stats/feed views.
 */

import type { LineageOverviewOptions } from "../../lib/lineageOverview";
import type { LineageOverview, LineageOverviewCounts } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { assetTypeLabel } from "../operations/operationStatsHelpers";
import {
  LINEAGE_FEED_LIMITS,
  buildLineageFeedOptions,
  lineageFeedRows,
  type LineageFeedRow,
} from "./lineageFeedHelpers";
import { lineageTypeLabel, lineageTypeTone } from "./lineageStatsHelpers";

/** Stable display name the backend uses when a relationship endpoint is missing. */
const UNKNOWN_ASSET_LABEL = "Unknown asset";

/** Render-ready one whole-source-asset count. */
export interface LineageOverviewCountRow {
  readonly key: keyof LineageOverviewCounts;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

/** Identity/context for the selected relationship header. */
export interface LineageOverviewIdentity {
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly fromName: string;
  readonly toName: string;
  readonly fromTypeLabel: string;
  readonly toTypeLabel: string;
  readonly hasTarget: boolean;
  readonly projectLabel: string;
  readonly shortId: string;
  readonly createdLabel: string;
}

/** Render-ready one sibling relationship (reuses the canonical feed row shape). */
export type LineageOverviewSiblingRow = LineageFeedRow;

/** One option in the relationship picker, fed by the authoritative lineage feed. */
export interface LineageOverviewPickerOption {
  readonly value: string;
  readonly label: string;
  readonly relationshipId: string;
}

/** Page bound reused for the bounded sibling list (counts are never bounded). */
export const LINEAGE_OVERVIEW_RECENT_LIMIT = 5;

const COUNT_DEFS: readonly {
  readonly key: keyof LineageOverviewCounts;
  readonly label: string;
  readonly hint: string;
}[] = [
  { key: "source_upstream", label: "Upstream", hint: "Assets feeding the source" },
  { key: "source_downstream", label: "Downstream", hint: "Assets derived from the source" },
  { key: "source_types", label: "Link types", hint: "Distinct relationship types on source" },
  { key: "project_relationships", label: "In project", hint: "Relationships in this project" },
];

/** One whole-source-asset counter, zero-filled when the snapshot is absent. */
export function lineageOverviewCount(
  overview?: LineageOverview | null,
  key: keyof LineageOverviewCounts = "source_upstream",
): number {
  const value = overview?.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Short relative label for a timestamp, or "" when absent. */
export function lineageOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function lineageOverviewGeneratedAtLabel(
  overview?: LineageOverview | null,
  now: number = Date.now(),
): string {
  return lineageOverviewRelativeLabel(overview?.generated_at, now);
}

/** All four whole-source-asset counters in a stable, zero-filled display order. */
export function lineageOverviewCountRows(
  overview?: LineageOverview | null,
): LineageOverviewCountRow[] {
  return COUNT_DEFS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    value: String(lineageOverviewCount(overview, key)),
  }));
}

/** Render-safe display name, falling back to the backend's stable sentinel. */
function displayName(value: string, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/** True when the relationship's target resolves to a live asset. */
export function lineageOverviewTargetKnown(overview?: LineageOverview | null): boolean {
  return displayName(overview?.to_asset_name ?? "", UNKNOWN_ASSET_LABEL) !== UNKNOWN_ASSET_LABEL;
}

/** Identity, badges and context for the snapshot header. */
export function lineageOverviewIdentity(
  overview?: LineageOverview | null,
  now: number = Date.now(),
): LineageOverviewIdentity {
  const toName = displayName(overview?.to_asset_name ?? "", UNKNOWN_ASSET_LABEL);
  return {
    typeLabel: overview ? lineageTypeLabel(overview.type) : "Relationship",
    typeTone: overview ? lineageTypeTone(overview.type) : "neutral",
    fromName: displayName(overview?.from_asset_name ?? "", UNKNOWN_ASSET_LABEL),
    toName,
    fromTypeLabel: assetTypeLabel(overview?.from_asset_type ?? ""),
    toTypeLabel: assetTypeLabel(overview?.to_asset_type ?? ""),
    hasTarget: toName !== UNKNOWN_ASSET_LABEL,
    projectLabel: displayName(overview?.project_name ?? "", "Unknown project"),
    shortId: overview?.id ? (overview.id.length > 8 ? `${overview.id.slice(0, 8)}…` : overview.id) : "",
    createdLabel: lineageOverviewRelativeLabel(overview?.created_at, now),
  };
}

/**
 * Bounded newest-first sibling relationships projected with the canonical feed
 * row helper so the snapshot's siblings look identical to the lineage feed.
 */
export function lineageOverviewRecentRows(
  overview?: LineageOverview | null,
  now: number = Date.now(),
): LineageOverviewSiblingRow[] {
  const items = overview?.recent_relationships ?? [];
  return lineageFeedRows(
    { items, total: items.length, generated_at: overview?.generated_at ?? "" },
    now,
  ) as LineageOverviewSiblingRow[];
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasLineageOverviewData(overview?: LineageOverview | null): boolean {
  if (!overview) return false;
  return (
    lineageOverviewCount(overview, "source_upstream") > 0 ||
    lineageOverviewCount(overview, "source_downstream") > 0 ||
    lineageOverviewCount(overview, "source_types") > 0 ||
    lineageOverviewCount(overview, "project_relationships") > 0 ||
    (overview.recent_relationships?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function lineageOverviewSummaryLabel(overview?: LineageOverview | null): string {
  if (!overview) return "";
  return [
    `${lineageOverviewCount(overview, "source_upstream")} upstream`,
    `${lineageOverviewCount(overview, "source_downstream")} downstream`,
    `${lineageOverviewCount(overview, "project_relationships")} in project`,
  ].join(" · ");
}

/** Filter-aware empty-state copy for the picker/feed. */
export function lineageOverviewEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Asset relationships in this project will appear here."
    : "Typed asset relationships will appear here as assets are derived and linked.";
}

/**
 * Picker options derived from the authoritative lineage-feed rows. The value is
 * the relationship id the overview hook needs; the label pairs the relationship
 * type with both endpoint names and the project so one selection resolves the
 * full snapshot.
 */
export function lineageOverviewPickerOptions(
  rows: readonly LineageFeedRow[],
): LineageOverviewPickerOption[] {
  return rows.map((row) => ({
    value: row.id,
    label: `${row.typeLabel}: ${row.fromAssetName} → ${row.toAssetName} · ${row.projectName}`,
    relationshipId: row.id,
  }));
}

/** Resolve the active picker option, falling back to the first available row. */
export function lineageOverviewActiveOption(
  options: readonly LineageOverviewPickerOption[],
  selectedValue: string,
): LineageOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}

/** Hook query options for the bounded sibling list. */
export function buildLineageOverviewOptions(
  recentLimit: number = LINEAGE_OVERVIEW_RECENT_LIMIT,
): LineageOverviewOptions {
  return { recentLimit };
}

/** Page-size chips offered for the feed that populates the picker. */
export const LINEAGE_OVERVIEW_FEED_LIMITS: readonly number[] = LINEAGE_FEED_LIMITS;

/** Hook query options for the picker's authoritative lineage feed. */
export const buildLineageOverviewFeedOptions = buildLineageFeedOptions;
