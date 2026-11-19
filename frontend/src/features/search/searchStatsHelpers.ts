/**
 * Display models for the authoritative search index statistics (C93/C95/C96
 * follow-up). Every value rendered by `SearchStatsPanel` is derived here from the
 * raw `SearchStats` payload so empty, partial and populated states stay consistent
 * across mock and live transports and JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The kind order mirrors the canonical
 * `SEARCH_STAT_KINDS` in `lib/searchStats` so the UI always shows a complete
 * zero-filled project/asset/conversation breakdown.
 */

import type { SearchKindCount, SearchResultKind, SearchStats } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface SearchStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface SearchKindRow {
  readonly kind: SearchResultKind;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all indexed documents, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

const KIND_ORDER: readonly SearchResultKind[] = ["project", "asset", "conversation"];

const KIND_LABELS: Readonly<Record<SearchResultKind, string>> = {
  project: "Project",
  asset: "Asset",
  conversation: "Conversation",
};

const KIND_TONE: Readonly<Record<SearchResultKind, BadgeTone>> = {
  project: "info",
  asset: "accent",
  conversation: "success",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function searchRelativeLabel(value?: string | null, now: number = Date.now()): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for the newest indexed document in the snapshot. */
export function newestDocumentLabel(stats?: SearchStats, now: number = Date.now()): string {
  return searchRelativeLabel(stats?.newest_document_at, now);
}

/** Human label for a canonical search result kind. */
export function searchKindLabel(kind: SearchResultKind): string {
  return KIND_LABELS[kind] ?? "Document";
}

/**
 * The authoritative totals plus index-coverage signals. `Indexed kinds` counts
 * kinds with at least one document; `Coverage` is their share of the three
 * canonical kinds, so a completely empty index shows 0%.
 */
export function searchStatsCards(
  stats?: SearchStats,
  now: number = Date.now(),
): SearchStatsCard[] {
  const kinds = searchKindRows(stats);
  const indexedKinds = kinds.filter((row) => row.count > 0).length;
  const coverage = Math.round((indexedKinds / KIND_ORDER.length) * 100);
  return [
    {
      key: "documents",
      label: "Documents",
      value: String(stats?.total_documents ?? 0),
      hint: "Searchable records",
    },
    {
      key: "newest",
      label: "Newest document",
      value: newestDocumentLabel(stats, now) || "—",
      hint: "Most recently updated",
    },
    {
      key: "kinds",
      label: "Indexed kinds",
      value: String(indexedKinds),
      hint: "Kinds with documents",
    },
    {
      key: "coverage",
      label: "Coverage",
      value: `${coverage}%`,
      hint: "Of canonical kinds",
    },
  ];
}

/** Zero-filled project/asset/conversation distribution with a share per kind. */
export function searchKindRows(stats?: SearchStats): SearchKindRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_kind ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.kind, entry.count);
  }
  const total = KIND_ORDER.reduce((sum, kind) => sum + (counts.get(kind) ?? 0), 0);
  return KIND_ORDER.map((kind) => {
    const count = counts.get(kind) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      kind,
      label: searchKindLabel(kind),
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: KIND_TONE[kind] ?? "neutral",
    };
  });
}

/** True when the snapshot carries at least one searchable document. */
export function hasSearchStatsData(stats?: SearchStats): boolean {
  if (!stats) return false;
  return stats.total_documents > 0;
}

/** Compact relative "generated at" label for the snapshot footer. */
export function searchStatsGeneratedAtLabel(
  stats?: SearchStats,
  now: number = Date.now(),
): string {
  return searchRelativeLabel(stats?.generated_at, now);
}

/** Count of well-formed kind buckets in a snapshot (for parity checks). */
export function validSearchKindCount(stats?: SearchStats): number {
  return (stats?.by_kind ?? []).filter(
    (entry: SearchKindCount) => Boolean(entry) && Number.isFinite(entry.count),
  ).length;
}
