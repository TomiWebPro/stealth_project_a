/**
 * Display models for the authoritative single-asset overview (C205/C207/C208
 * follow-up). Every value rendered by `AssetOverviewPanel` is derived here from
 * the raw `AssetOverview` snapshot so loading/error/missing/empty/populated
 * states stay consistent across mock and live transports and the JSX stays free
 * of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown asset)
 * and return zero-filled, render-safe values. The count order mirrors the
 * canonical `AssetOverviewCounts` contract so the UI always shows a complete
 * cross-domain breakdown.
 */

import type { AssetOverview, AssetOverviewCounts, AssetVersion } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { assetTypeTone, formatRelative } from "../home/format";
import {
  assetStatusLabel,
  assetStatusTone,
  assetTypeLabel,
  formatBytes,
} from "./assetStatsHelpers";

export interface AssetOverviewCountRow {
  readonly key: keyof AssetOverviewCounts;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface AssetOverviewIdentity {
  readonly name: string;
  readonly typeLabel: string;
  readonly typeTone: BadgeTone;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly versionLabel: string;
  readonly publishedLabel: string;
  readonly publishedTone: BadgeTone;
  readonly projectLabel: string;
  readonly createdLabel: string;
  readonly generatedLabel: string;
}

export interface AssetOverviewVersionRow {
  readonly id: string;
  readonly versionLabel: string;
  readonly bytesLabel: string;
  readonly creatorLabel: string;
  readonly relativeTime: string;
  readonly timestamp: string;
}

const COUNT_DEFS: readonly {
  readonly key: keyof AssetOverviewCounts;
  readonly label: string;
  readonly hint: string;
}[] = [
  { key: "versions", label: "Versions", hint: "Recorded revisions" },
  { key: "upstream", label: "Upstream", hint: "Live lineage parents" },
  { key: "downstream", label: "Downstream", hint: "Live derived assets" },
  { key: "comments", label: "Comments", hint: "Referencing notes" },
  { key: "tags", label: "Tags", hint: "Assigned labels" },
];

/** One cross-domain count, zero-filled when the snapshot is absent. */
export function assetOverviewCount(
  overview?: AssetOverview | null,
  key: keyof AssetOverviewCounts = "versions",
): number {
  const value = overview?.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function assetOverviewRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function assetOverviewGeneratedAtLabel(
  overview?: AssetOverview | null,
  now: number = Date.now(),
): string {
  return assetOverviewRelativeLabel(overview?.generated_at, now);
}

/** All five cross-domain counters in a stable, zero-filled display order. */
export function assetOverviewCountRows(overview?: AssetOverview | null): AssetOverviewCountRow[] {
  return COUNT_DEFS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    value: String(assetOverviewCount(overview, key)),
  }));
}

/** Short, render-safe label for an id (uuids are abbreviated). */
export function assetOverviewActorLabel(value?: string | null): string {
  if (!value) return "—";
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

/** Asset identity badges + creation/generation recency for the snapshot header. */
export function assetOverviewIdentity(
  overview?: AssetOverview | null,
  now: number = Date.now(),
): AssetOverviewIdentity {
  const version = overview?.version;
  return {
    name: overview?.asset_name || "—",
    typeLabel: overview ? assetTypeLabel(overview.asset_type) : "—",
    typeTone: overview ? assetTypeTone(overview.asset_type) : "neutral",
    statusLabel: overview ? assetStatusLabel(overview.status) : "—",
    statusTone: overview ? assetStatusTone(overview.status) : "neutral",
    versionLabel: typeof version === "number" && Number.isFinite(version) ? `v${version}` : "—",
    publishedLabel: overview?.published ? "Published" : "Not published",
    publishedTone: overview?.published ? "success" : "neutral",
    projectLabel: overview?.project_name || "",
    createdLabel: assetOverviewRelativeLabel(overview?.created_at, now),
    generatedLabel: assetOverviewRelativeLabel(overview?.generated_at, now),
  };
}

/** Newest-first recent version records projected into render-safe display rows. */
export function assetOverviewRecentVersions(
  overview?: AssetOverview | null,
  now: number = Date.now(),
): AssetOverviewVersionRow[] {
  return (overview?.recent_versions ?? []).map((version: AssetVersion) => ({
    id: `${version.asset_id}:${version.version}`,
    versionLabel: `v${version.version}`,
    bytesLabel: formatBytes(version.storage?.size_bytes),
    creatorLabel: assetOverviewActorLabel(version.created_by),
    relativeTime: assetOverviewRelativeLabel(version.created_at, now),
    timestamp: version.created_at,
  }));
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasAssetOverviewData(overview?: AssetOverview | null): boolean {
  if (!overview) return false;
  const hasCounts = COUNT_DEFS.some(({ key }) => assetOverviewCount(overview, key) > 0);
  return hasCounts || overview.published || (overview.recent_versions?.length ?? 0) > 0;
}

/** One-line summary for the panel header/footer. */
export function assetOverviewSummaryLabel(overview?: AssetOverview | null): string {
  if (!overview) return "";
  const upstream = assetOverviewCount(overview, "upstream");
  const downstream = assetOverviewCount(overview, "downstream");
  return [
    `${assetOverviewCount(overview, "versions")} versions`,
    `${upstream + downstream} lineage links`,
    `${assetOverviewCount(overview, "comments")} comments`,
    `${assetOverviewCount(overview, "tags")} tags`,
  ].join(" · ");
}
