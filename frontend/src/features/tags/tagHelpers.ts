/**
 * Display models for the authoritative asset tag-facet index (C33/C36 follow-up).
 *
 * The backend derives a most-used-first tag index from the authoritative asset
 * store and the mocks transport mirrors that derivation. This module only turns
 * the canonical payload into render-ready rows, so the panel JSX stays free of
 * inline mapping and both transports render identically. Every helper tolerates
 * `undefined` (query not settled / error) and returns render-safe values.
 */

import type { TagOptions } from "../../lib/tags";
import type { TagFacet, TagIndex } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

export interface TagFacetItem {
  readonly name: string;
  readonly count: number;
  readonly countLabel: string;
  /** 0..100 share relative to the most-used facet, used by the width bar. */
  readonly sharePercent: number;
  readonly tone: BadgeTone;
}

/** Facet-count chips shown above the index. */
export const TAG_LIMITS: readonly number[] = [10, 25, 50];

function toneForShare(count: number, max: number): BadgeTone {
  if (count <= 0 || max <= 0) return "neutral";
  const share = count / max;
  if (share >= 0.75) return "accent";
  if (share >= 0.4) return "info";
  return "neutral";
}

/**
 * Map a canonical `TagIndex` to render-ready facets. The transports already
 * return most-used-first order; re-applying the same comparator here keeps the
 * view deterministic if a transport ever returns an unsorted payload.
 */
export function tagFacetItems(index: TagIndex | undefined): readonly TagFacetItem[] {
  const facets: readonly TagFacet[] = index?.tags ?? [];
  const sorted = [...facets].sort(
    (a, b) =>
      b.count - a.count ||
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||
      a.name.localeCompare(b.name),
  );
  const max = sorted.reduce((highest, facet) => Math.max(highest, facet.count), 0);

  return sorted.map((facet) => ({
    name: facet.name,
    count: facet.count,
    countLabel: `${facet.count} asset${facet.count === 1 ? "" : "s"}`,
    sharePercent: max > 0 ? Math.round((facet.count / max) * 100) : 0,
    tone: toneForShare(facet.count, max),
  }));
}

/** Header description derived from visible facets and the untruncated total. */
export function tagIndexSummary(items: readonly TagFacetItem[], total?: number): string {
  if (items.length === 0) return "No tags indexed";
  const count = total ?? items.length;
  const top = items[0];
  return `${count} tag${count === 1 ? "" : "s"} · most used: ${top?.name ?? "—"} (${top?.countLabel ?? "—"})`;
}

/** Build the hook options from the prefix input, count chip and project scope. */
export function buildTagOptions(
  prefix: string,
  limit: number,
  projectId?: string,
): TagOptions {
  const trimmed = prefix.trim();
  return {
    ...(trimmed ? { prefix: trimmed } : {}),
    limit,
    ...(projectId ? { projectId } : {}),
  };
}

/** Filter-aware empty-state copy for the panel. */
export function tagEmptyDescription(prefix: string): string {
  const trimmed = prefix.trim();
  return trimmed
    ? `No tags match the prefix "${trimmed}". Try a different prefix.`
    : "Tags appear here as assets are generated or imported with tags.";
}
