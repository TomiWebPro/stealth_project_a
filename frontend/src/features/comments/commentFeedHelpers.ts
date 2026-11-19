/**
 * Display models for the authoritative comment feed (C149/C151/C152
 * follow-up). The backend derives the newest-first, workspace-wide feed fresh
 * from the authoritative `COMMENTS` collection — the same store `/comments` and
 * `/collaboration/stats` read — and the mocks transport mirrors that derivation.
 * This module only turns the canonical `CommentFeed` payload into render-ready
 * rows so the panel JSX stays free of inline mapping and both transports render
 * identically. Every helper tolerates `undefined` (query not settled or failed)
 * and returns render-safe values.
 */

import type { CommentFeedOptions } from "../../lib/commentFeed";
import type { CommentFeed, CommentFeedItem } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

/** Render-ready row for one comment in the feed. */
export interface CommentFeedRow {
  readonly id: string;
  readonly commentId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly assetId: string | null;
  readonly hasAsset: boolean;
  readonly assetLabel: string;
  readonly authorId: string;
  readonly authorLabel: string;
  readonly authorTone: BadgeTone;
  readonly body: string;
  readonly bodyPreview: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const COMMENT_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Hook query options from the active project scope and page size. */
export function buildCommentFeedOptions(
  projectId: string | undefined,
  limit: number,
): CommentFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    limit,
  };
}

/** Compact, render-safe label for an opaque entity id. */
export function shortIdLabel(value: string, prefix: string): string {
  const clean = value.trim();
  if (!clean) return prefix;
  return clean.length > 8 ? `${prefix} ${clean.slice(0, 8)}…` : `${prefix} ${clean}`;
}

/** Single-line, bounded preview for a comment body. */
export function commentBodyPreview(body: string, max: number = 180): string {
  if (typeof body !== "string") return "No comment text";
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return "No comment text";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1))}…`;
}

/** Map a canonical feed to render-ready rows (already newest-first on the wire). */
export function commentFeedRows(
  feed: CommentFeed | undefined,
  now: number = Date.now(),
): readonly CommentFeedRow[] {
  const items: readonly CommentFeedItem[] = feed?.items ?? [];
  return items.map((item) => {
    const assetId = item.asset_id ?? null;
    return {
      id: item.comment_id,
      commentId: item.comment_id,
      projectId: item.project_id,
      projectName: item.project_name,
      assetId,
      hasAsset: Boolean(assetId),
      assetLabel: assetId ? shortIdLabel(assetId, "Asset") : "",
      authorId: item.author_id,
      authorLabel: shortIdLabel(item.author_id, "Author"),
      authorTone: "info" as const,
      body: item.body,
      bodyPreview: commentBodyPreview(item.body),
      timestamp: item.created_at,
      relativeTime: formatRelative(item.created_at, now),
    };
  });
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all comments in scope before the `limit` page is applied.
 */
export function commentFeedSummary(rows: readonly CommentFeedRow[], total?: number): string {
  if (rows.length === 0) return "No comments";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} comments · latest in ${latest?.projectName ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function commentFeedGeneratedAtLabel(
  feed: CommentFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Filter-aware empty-state copy for the feed. */
export function commentFeedEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Comments added to this project will appear here."
    : "Collaboration comments will appear here as teammates post updates.";
}
