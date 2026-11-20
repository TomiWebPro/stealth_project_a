/**
 * Display models for the authoritative single-tag overview (C282/C284/C285
 * follow-up). The backend derives the whole snapshot fresh from the
 * authoritative `ASSETS` store — the same store `/tags` facets and
 * `/assets/feed` read — and the mocks transport mirrors that derivation. This
 * module only turns the canonical `TagOverview` payload and the tag index (used
 * to populate the picker) into render-ready values so `TagOverviewPanel` stays
 * free of inline mapping and both transports render identically.
 *
 * Every helper tolerates `undefined` (query not settled / failed / unknown
 * tag) and returns render-safe, zero-filled values. The recent-asset rows
 * reuse the canonical asset-feed helper so this view cannot drift from the
 * asset feed, stats or browser screens.
 */

import type { TagOverviewOptions } from "../../lib/tagOverview";
import type { TagOptions } from "../../lib/tags";
import type { TagOverview, TagOverviewCounts } from "../../lib/types";
import { formatRelative } from "../home/format";
import {
  assetFeedRows,
  type AssetFeedRow,
} from "../assets/assetFeedHelpers";
import { buildTagOptions, type TagFacetItem } from "./tagHelpers";

/** Page size used to populate the tag picker from the authoritative tag index. */
export const TAG_OVERVIEW_PICKER_LIMIT = 50;

/** Default bounded recent-asset page size. */
export const TAG_OVERVIEW_DEFAULT_RECENT_LIMIT = 5;

/** Recent-asset page-size chips offered above the overview. */
export const TAG_OVERVIEW_RECENT_LIMITS: readonly number[] = [
  TAG_OVERVIEW_DEFAULT_RECENT_LIMIT,
  10,
  25,
];

export interface TagOverviewCountRow {
  readonly key: keyof TagOverviewCounts;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface TagOverviewIdentity {
  readonly tagLabel: string;
  readonly projectLabel: string;
  readonly scopeLabel: string;
  readonly generatedLabel: string;
}

export interface TagOverviewPickerOption {
  readonly value: string;
  readonly label: string;
}

const COUNT_DEFS: readonly {
  readonly key: keyof TagOverviewCounts;
  readonly label: string;
  readonly hint: string;
}[] = [
  {
    key: "tagged_assets",
    label: "Tagged assets",
    hint: "Assets carrying this tag in scope",
  },
  {
    key: "tagged_projects",
    label: "Projects",
    hint: "Distinct projects with tagged assets",
  },
  {
    key: "scope_assets",
    label: "Assets in scope",
    hint: "Live assets in the selected scope",
  },
];

/** Hook options for the bounded recent-asset projection and optional scope. */
export function buildTagOverviewOptions(
  recentLimit: number = TAG_OVERVIEW_DEFAULT_RECENT_LIMIT,
  projectId?: string,
): TagOverviewOptions {
  return {
    ...(projectId ? { projectId } : {}),
    recentLimit,
  };
}

/** Tag-index options used to populate the picker, optionally project-scoped. */
export function buildTagOverviewPickerOptions(projectId?: string): TagOptions {
  return buildTagOptions("", TAG_OVERVIEW_PICKER_LIMIT, projectId);
}

/** One whole-scope count, zero-filled when the snapshot is absent or malformed. */
export function tagOverviewCount(
  overview?: TagOverview | null,
  key: keyof TagOverviewCounts = "tagged_assets",
): number {
  const value = overview?.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** The three whole-scope tag counters in a stable, zero-filled display order. */
export function tagOverviewCountRows(overview?: TagOverview | null): TagOverviewCountRow[] {
  return COUNT_DEFS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    value: String(tagOverviewCount(overview, key)),
  }));
}

/** `#tag` label, joined scope and recency for the snapshot header. */
export function tagOverviewIdentity(
  overview?: TagOverview | null,
  now: number = Date.now(),
): TagOverviewIdentity {
  return {
    tagLabel: overview?.tag ? `#${overview.tag}` : "#—",
    projectLabel: overview?.project_name || "",
    scopeLabel: overview?.project_name || "Whole workspace",
    generatedLabel: tagOverviewGeneratedAtLabel(overview, now) || "—",
  };
}

/**
 * Bounded newest-first tagged assets projected into render-ready rows via the
 * canonical asset-feed helper, so badges, sizes and recency match the feed.
 */
export function tagOverviewRecentAssets(
  overview?: TagOverview | null,
  now: number = Date.now(),
): readonly AssetFeedRow[] {
  const items = overview?.recent_assets ?? [];
  if (items.length === 0) return [];
  return assetFeedRows(
    {
      items,
      total: items.length,
      generated_at: overview?.generated_at ?? "",
    },
    now,
  );
}

/** Relative label for when the snapshot was generated, or "" when absent. */
export function tagOverviewGeneratedAtLabel(
  overview?: TagOverview | null,
  now: number = Date.now(),
): string {
  if (!overview?.generated_at) return "";
  return formatRelative(overview.generated_at, now);
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasTagOverviewData(overview?: TagOverview | null): boolean {
  if (!overview) return false;
  return (
    tagOverviewCount(overview, "tagged_assets") > 0 ||
    tagOverviewCount(overview, "tagged_projects") > 0 ||
    tagOverviewCount(overview, "scope_assets") > 0 ||
    (overview.recent_assets?.length ?? 0) > 0
  );
}

/** One-line summary for the panel footer. */
export function tagOverviewSummaryLabel(overview?: TagOverview | null): string {
  if (!overview) return "";
  return [
    `${tagOverviewCount(overview, "tagged_assets")} tagged assets`,
    `${tagOverviewCount(overview, "tagged_projects")} projects`,
    `${tagOverviewCount(overview, "scope_assets")} in scope`,
  ].join(" · ");
}

/** Scope-aware empty-state copy for the panel. */
export function tagOverviewEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "No tag in this project has indexed assets yet. Tags appear as assets are generated or imported."
    : "No tag has indexed assets yet. Tags appear as assets are generated or imported across the workspace.";
}

/**
 * Picker options derived from the authoritative tag index already shown in the
 * tag-facet panel, so this view cannot disagree with the index. The value is the
 * tag name, which is exactly what the overview hook needs.
 */
export function tagOverviewPickerOptions(
  items: readonly TagFacetItem[],
): TagOverviewPickerOption[] {
  return items.map((item) => ({
    value: item.name,
    label: `${item.name} · ${item.countLabel}`,
  }));
}

/** Resolve the active picker option, falling back to the first available tag. */
export function tagOverviewActiveOption(
  options: readonly TagOverviewPickerOption[],
  selectedValue: string,
): TagOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}
