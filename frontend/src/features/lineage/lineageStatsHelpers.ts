/**
 * Display models for the authoritative asset-lineage statistics (C77/C79/C80
 * follow-up). Every value rendered by `LineageStatsPanel` is derived here from
 * the raw `LineageStats` payload so empty, partial and populated states stay
 * consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The five relationship types are always
 * present in the canonical order used by `lib/lineageStats` and the backend's
 * zero-filled breakdown.
 */

import type { LineageStats, RelationshipType } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface LineageStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface LineageTypeRow {
  readonly type: RelationshipType;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all relationships produced by this type, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface LineageProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly relationships: number;
  /** Rounded share of all relationships originating from this project, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
}

const TYPE_LABELS: Readonly<Record<RelationshipType, string>> = {
  derived_from: "Derived from",
  variant_of: "Variant of",
  uses_input: "Uses input",
  related_to: "Related to",
  duplicate_of: "Duplicate of",
};

const TYPE_TONES: Readonly<Record<RelationshipType, BadgeTone>> = {
  derived_from: "info",
  variant_of: "accent",
  uses_input: "warning",
  related_to: "neutral",
  duplicate_of: "danger",
};

const CANONICAL_TYPES: readonly RelationshipType[] = [
  "derived_from",
  "variant_of",
  "uses_input",
  "related_to",
  "duplicate_of",
];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Python-compatible lexicographic ordering for deterministic id tie-breaks. */
function compareNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Friendly label for a canonical relationship type, or a humanized fallback. */
export function lineageTypeLabel(type: RelationshipType | string): string {
  if (Object.prototype.hasOwnProperty.call(TYPE_LABELS, type)) {
    return TYPE_LABELS[type as RelationshipType];
  }
  return String(type)
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Stable badge tone for a relationship type. */
export function lineageTypeTone(type: RelationshipType | string): BadgeTone {
  if (Object.prototype.hasOwnProperty.call(TYPE_TONES, type)) {
    return TYPE_TONES[type as RelationshipType];
  }
  return "neutral";
}

/** Short, readable id for a project row. */
export function lineageProjectLabel(projectId: string): string {
  if (!projectId) return "";
  return projectId.length > 8 ? `${projectId.slice(0, 8)}…` : projectId;
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function lineageStatsRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** The authoritative counters plus the number of relationship types in use. */
export function lineageStatsCards(stats?: LineageStats): LineageStat[] {
  const activeTypes = (stats?.by_type ?? []).filter((row) => row.count > 0).length;
  return [
    {
      key: "relationships",
      label: "Relationships",
      value: String(stats?.total_relationships ?? 0),
      hint: "Asset links",
    },
    {
      key: "assets",
      label: "Linked assets",
      value: String(stats?.total_linked_assets ?? 0),
      hint: "Distinct endpoints",
    },
    {
      key: "types",
      label: "Types in use",
      value: String(activeTypes),
      hint: "Relationship kinds",
    },
  ];
}

/**
 * Zero-filled per-type breakdown in canonical order. Any additional
 * (non-canonical) types from a payload are appended after them so the UI never
 * drops data while keeping a deterministic order.
 */
export function lineageTypeRows(stats?: LineageStats): LineageTypeRow[] {
  const entries = stats?.by_type ?? [];
  const total = stats?.total_relationships ?? 0;
  const byType = new Map<string, (typeof entries)[number]>(
    entries.map((row) => [String(row.type), row]),
  );
  const order: string[] = [...CANONICAL_TYPES];
  for (const key of byType.keys()) {
    if (!order.includes(key)) order.push(key);
  }

  return order.map((type) => {
    const row = byType.get(type);
    const count = Number.isFinite(row?.count) ? (row?.count ?? 0) : 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      type: type as RelationshipType,
      label: lineageTypeLabel(type),
      count,
      percent: Math.round(fraction * 100),
      fraction,
      tone: lineageTypeTone(type),
    };
  });
}

/**
 * Per-project relationship counts, sorted count-descending then by project id
 * for deterministic cross-backend order. `limit` caps the number of rows shown.
 */
export function lineageProjectRows(
  stats?: LineageStats,
  limit: number = 5,
): LineageProjectRow[] {
  const total = stats?.total_relationships ?? 0;
  const entries = (stats?.by_project ?? [])
    .filter((row) => row && Number.isFinite(row.relationships))
    .sort((a, b) => b.relationships - a.relationships || compareNames(a.project_id, b.project_id));
  const capped = Number.isFinite(limit) && limit > 0 ? entries.slice(0, limit) : entries;

  return capped.map((row) => {
    const fraction = clamp01(total > 0 ? row.relationships / total : 0);
    return {
      projectId: row.project_id,
      label: lineageProjectLabel(row.project_id),
      relationships: row.relationships,
      percent: Math.round(fraction * 100),
      fraction,
    };
  });
}

/**
 * True when the snapshot carries any non-zero relationship/link metrics. The
 * backend always zero-fills the five type buckets, so their presence alone is
 * not evidence of data — only positive counts are.
 */
export function hasLineageStatsData(stats?: LineageStats): boolean {
  if (!stats) return false;
  if (stats.total_relationships > 0 || stats.total_linked_assets > 0) {
    return true;
  }
  if ((stats.by_type ?? []).some((row) => row.count > 0)) {
    return true;
  }
  return (stats.by_project ?? []).some((row) => row.relationships > 0);
}

/** Compact relative "generated at" label for the snapshot footer. */
export function lineageStatsGeneratedAtLabel(
  stats?: LineageStats,
  now: number = Date.now(),
): string {
  return lineageStatsRelativeLabel(stats?.generated_at, now);
}

/** Compact relative recency label for the newest relationship, or an empty label. */
export function newestRelationshipLabel(
  stats?: LineageStats,
  now: number = Date.now(),
): string {
  return lineageStatsRelativeLabel(stats?.newest_relationship_at, now);
}
