/**
 * Display models for the authoritative comment statistics (C165/C167/C168
 * follow-up). Every value rendered by `CommentStatsPanel` is derived here from
 * the raw `CommentStats` payload so empty, partial and populated states stay
 * consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The reference-category order mirrors the
 * canonical `COMMENT_REFERENCES` in `lib/commentStats`, so the UI always shows a
 * complete zero-filled asset/project breakdown.
 */

import type {
  CommentAuthorCount,
  CommentProjectCount,
  CommentReference,
  CommentStats,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface CommentStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface CommentReferenceRow {
  readonly reference: CommentReference;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all comments, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface CommentProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly comments: number;
  readonly authors: number;
  /** Total author signals recorded for this project. */
  readonly activity: number;
}

export interface CommentAuthorRow {
  readonly authorId: string;
  readonly label: string;
  readonly comments: number;
}

const REFERENCE_ORDER: readonly CommentReference[] = ["asset", "project"];

const REFERENCE_LABEL: Readonly<Record<CommentReference, string>> = {
  asset: "Asset references",
  project: "Project-level",
};

const REFERENCE_TONE: Readonly<Record<CommentReference, BadgeTone>> = {
  asset: "accent",
  project: "info",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function commentStatsRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Short, stable label for an entity id when no friendly name is known. */
export function shortCommentEntityId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Relative label for the newest comment recency signal. */
export function newestCommentLabel(stats?: CommentStats, now: number = Date.now()): string {
  return commentStatsRelativeLabel(stats?.newest_comment_at, now);
}

/** The three authoritative counters plus the newest-comment recency. */
export function commentStatsCards(
  stats?: CommentStats,
  now: number = Date.now(),
): CommentStatsCard[] {
  return [
    {
      key: "comments",
      label: "Comments",
      value: String(stats?.total_comments ?? 0),
      hint: "Recorded discussions",
    },
    {
      key: "authors",
      label: "Authors",
      value: String(stats?.total_authors ?? 0),
      hint: "Distinct commenters",
    },
    {
      key: "projects",
      label: "Projects",
      value: String(stats?.total_projects ?? 0),
      hint: "Projects discussed",
    },
    {
      key: "latest",
      label: "Latest comment",
      value: newestCommentLabel(stats, now) || "—",
      hint: "Most recent signal",
    },
  ];
}

/** Zero-filled asset/project reference distribution with a share per category. */
export function commentReferenceRows(stats?: CommentStats): CommentReferenceRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_reference ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.reference, entry.count);
  }
  const total = REFERENCE_ORDER.reduce((sum, reference) => sum + (counts.get(reference) ?? 0), 0);
  return REFERENCE_ORDER.map((reference) => {
    const count = counts.get(reference) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      reference,
      label: REFERENCE_LABEL[reference] ?? reference,
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: REFERENCE_TONE[reference] ?? "neutral",
    };
  });
}

/**
 * Per-project comment/author activity. Rows keep the backend's deterministic
 * (descending comments, then id) order; friendly names resolve through
 * `projectNames` and fall back to a short id.
 */
export function commentProjectRows(
  stats?: CommentStats,
  projectNames: Readonly<Record<string, string>> = {},
): CommentProjectRow[] {
  return [...(stats?.by_project ?? [])]
    .filter(
      (entry): entry is CommentProjectCount =>
        Boolean(entry) && Number.isFinite(entry.comments) && Number.isFinite(entry.authors),
    )
    .sort((a, b) => b.comments - a.comments || a.project_id.localeCompare(b.project_id))
    .map((entry) => ({
      projectId: entry.project_id,
      label: projectNames[entry.project_id] || shortCommentEntityId(entry.project_id),
      comments: entry.comments,
      authors: entry.authors,
      activity: entry.comments + entry.authors,
    }));
}

/** Per-author comment counts in the backend's deterministic order. */
export function commentAuthorRows(stats?: CommentStats): CommentAuthorRow[] {
  return [...(stats?.by_author ?? [])]
    .filter(
      (entry): entry is CommentAuthorCount =>
        Boolean(entry) && Number.isFinite(entry.comments) && typeof entry.author_id === "string",
    )
    .sort((a, b) => b.comments - a.comments || a.author_id.localeCompare(b.author_id))
    .map((entry) => ({
      authorId: entry.author_id,
      label: shortCommentEntityId(entry.author_id),
      comments: entry.comments,
    }));
}

/** True when the snapshot carries any comment, author or project activity. */
export function hasCommentStatsData(stats?: CommentStats): boolean {
  if (!stats) return false;
  return stats.total_comments > 0 || stats.total_authors > 0 || stats.total_projects > 0;
}

/** Compact relative "generated at" label for the snapshot footer. */
export function commentStatsGeneratedAtLabel(
  stats?: CommentStats,
  now: number = Date.now(),
): string {
  return commentStatsRelativeLabel(stats?.generated_at, now);
}
