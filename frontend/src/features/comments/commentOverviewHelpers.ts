/**
 * Display models for the authoritative single-comment overview (C254/C256/C257
 * follow-up). Every value rendered by `CommentOverviewPanel` is derived here from
 * the raw `CommentOverview` snapshot so loading/error/missing/empty/populated
 * states stay consistent across mock and live transports and the JSX stays free
 * of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown comment)
 * and return zero-filled, render-safe values. The picker options are derived
 * from the authoritative comment-feed rows already shown elsewhere so this view
 * cannot disagree with the comment feed.
 */

import type { CommentOverviewOptions } from "../../lib/commentOverview";
import type {
  CommentFeedItem,
  CommentOverview,
  CommentOverviewCounts,
  CommentReference,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { commentBodyPreview, shortIdLabel, type CommentFeedRow } from "./commentFeedHelpers";

export interface CommentOverviewCountRow {
  readonly key: keyof CommentOverviewCounts;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface CommentOverviewIdentity {
  readonly authorLabel: string;
  readonly referenceLabel: string;
  readonly referenceTone: BadgeTone;
  readonly hasAsset: boolean;
  readonly assetLabel: string;
  readonly projectLabel: string;
  readonly bodyPreview: string;
  readonly createdLabel: string;
}

export interface CommentOverviewSiblingRow {
  readonly id: string;
  readonly authorLabel: string;
  readonly bodyPreview: string;
  readonly hasAsset: boolean;
  readonly assetLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

export interface CommentOverviewPickerOption {
  readonly value: string;
  readonly label: string;
  readonly commentId: string;
}

/** Page bound used for the bounded same-thread list (counts are never bounded). */
export const COMMENT_OVERVIEW_RECENT_LIMIT = 5;

const COUNT_DEFS: readonly {
  readonly key: keyof CommentOverviewCounts;
  readonly label: string;
  readonly hint: string;
}[] = [
  { key: "project_comments", label: "Comments", hint: "Comments in this project" },
  { key: "project_authors", label: "Authors", hint: "Distinct commenters in project" },
  { key: "project_assets", label: "Assets", hint: "Assets referenced in project" },
  { key: "thread_comments", label: "Thread", hint: "Comments in this thread" },
];

const REFERENCE_LABEL: Readonly<Record<CommentReference, string>> = {
  asset: "Asset reference",
  project: "Project-level",
};

const REFERENCE_TONE: Readonly<Record<CommentReference, BadgeTone>> = {
  asset: "accent",
  project: "info",
};

/** One whole-project/same-thread count, zero-filled when the snapshot is absent. */
export function commentOverviewCount(
  overview?: CommentOverview | null,
  key: keyof CommentOverviewCounts = "project_comments",
): number {
  const value = overview?.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Short relative label for a timestamp, or "" when absent. */
export function commentOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function commentOverviewGeneratedAtLabel(
  overview?: CommentOverview | null,
  now: number = Date.now(),
): string {
  return commentOverviewRelativeLabel(overview?.generated_at, now);
}

/** All four activity counters in a stable, zero-filled display order. */
export function commentOverviewCountRows(
  overview?: CommentOverview | null,
): CommentOverviewCountRow[] {
  return COUNT_DEFS.map(({ key, label, hint }) => ({
    key,
    label,
    hint,
    value: String(commentOverviewCount(overview, key)),
  }));
}

/** Reference-category badge label, tolerant of an unexpected wire value. */
export function commentOverviewReferenceLabel(reference?: CommentReference | null): string {
  return reference && REFERENCE_LABEL[reference] ? REFERENCE_LABEL[reference] : "Comment";
}

/** Reference-category badge tone, tolerant of an unexpected wire value. */
export function commentOverviewReferenceTone(reference?: CommentReference | null): BadgeTone {
  return reference && REFERENCE_TONE[reference] ? REFERENCE_TONE[reference] : "neutral";
}

/** Identity, reference badge and body preview for the snapshot header. */
export function commentOverviewIdentity(
  overview?: CommentOverview | null,
  now: number = Date.now(),
): CommentOverviewIdentity {
  const assetId = overview?.asset_id ?? null;
  return {
    authorLabel: overview?.author_id ? shortIdLabel(overview.author_id, "Author") : "—",
    referenceLabel: commentOverviewReferenceLabel(overview?.reference),
    referenceTone: commentOverviewReferenceTone(overview?.reference),
    hasAsset: Boolean(assetId),
    assetLabel: assetId ? shortIdLabel(assetId, "Asset") : "",
    projectLabel: overview?.project_name || "",
    bodyPreview: commentBodyPreview(overview?.body ?? ""),
    createdLabel: commentOverviewRelativeLabel(overview?.created_at, now),
  };
}

/** Bounded newest-first same-thread comments projected into render-safe rows. */
export function commentOverviewRecentComments(
  overview?: CommentOverview | null,
  now: number = Date.now(),
): CommentOverviewSiblingRow[] {
  const items: readonly CommentFeedItem[] = overview?.recent_comments ?? [];
  return items.map((item) => {
    const assetId = item.asset_id ?? null;
    return {
      id: item.comment_id,
      authorLabel: shortIdLabel(item.author_id, "Author"),
      bodyPreview: commentBodyPreview(item.body),
      hasAsset: Boolean(assetId),
      assetLabel: assetId ? shortIdLabel(assetId, "Asset") : "",
      timestamp: item.created_at,
      relativeTime: commentOverviewRelativeLabel(item.created_at, now),
    };
  });
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasCommentOverviewData(overview?: CommentOverview | null): boolean {
  if (!overview) return false;
  return (
    commentOverviewCount(overview, "project_comments") > 0 ||
    commentOverviewCount(overview, "project_authors") > 0 ||
    commentOverviewCount(overview, "project_assets") > 0 ||
    commentOverviewCount(overview, "thread_comments") > 0 ||
    (overview.recent_comments?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function commentOverviewSummaryLabel(overview?: CommentOverview | null): string {
  if (!overview) return "";
  return [
    `${commentOverviewCount(overview, "project_comments")} comments`,
    `${commentOverviewCount(overview, "project_authors")} authors`,
    `${commentOverviewCount(overview, "thread_comments")} in thread`,
  ].join(" · ");
}

/** Filter-aware empty-state copy for the picker/feed. */
export function commentOverviewEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Comments added to this project will appear here."
    : "Collaboration comments will appear here as teammates post updates.";
}

/**
 * Picker options derived from the authoritative comment-feed rows. The value is
 * the comment id the overview hook needs; the label pairs a body preview with
 * the joined project name so a single selection resolves the full snapshot.
 */
export function commentOverviewPickerOptions(
  rows: readonly CommentFeedRow[],
): CommentOverviewPickerOption[] {
  return rows.map((row) => ({
    value: row.commentId,
    label: `${row.bodyPreview} · ${row.projectName}`,
    commentId: row.commentId,
  }));
}

/** Resolve the active picker option, falling back to the first available row. */
export function commentOverviewActiveOption(
  options: readonly CommentOverviewPickerOption[],
  selectedValue: string,
): CommentOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}

/** Hook query options for the bounded same-thread list. */
export function buildCommentOverviewOptions(
  recentLimit: number = COMMENT_OVERVIEW_RECENT_LIMIT,
): CommentOverviewOptions {
  return { recentLimit };
}
