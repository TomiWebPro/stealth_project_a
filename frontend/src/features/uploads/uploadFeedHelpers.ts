/**
 * Display models for the authoritative upload-ticket feed (C129/C131/C132
 * follow-up). The backend derives the newest-first feed fresh from the same
 * authoritative `UPLOADS` store `/uploads/stats` reads, and the mocks transport
 * mirrors that derivation. This module only turns the canonical `UploadFeed`
 * payload into render-ready rows so the panel JSX stays free of inline mapping
 * and both transports render identically. Every helper tolerates `undefined`
 * (query not settled or failed) and returns render-safe values.
 */

import type { UploadFeedOptions } from "../../lib/uploadFeed";
import type { UploadFeed, UploadFeedItem, UploadStatus } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { formatBytes, uploadStatusLabel, uploadStatusTone } from "./uploadStatsHelpers";

/** Render-ready row for one upload ticket. */
export interface UploadFeedRow {
  readonly id: string;
  readonly uploadId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly filename: string;
  readonly contentType: string;
  readonly status: UploadStatus;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly declaredSizeLabel: string;
  readonly sizeLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
  readonly expiresLabel: string;
}

/** Page-size chips offered above the feed. */
export const UPLOAD_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Hook query options from the active project scope and page size. */
export function buildUploadFeedOptions(
  projectId: string | undefined,
  limit: number,
): UploadFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    limit,
  };
}

/** Map a canonical feed payload to render-ready rows (already newest-first). */
export function uploadFeedRows(
  feed: UploadFeed | undefined,
  now: number = Date.now(),
): readonly UploadFeedRow[] {
  const items: readonly UploadFeedItem[] = feed?.items ?? [];
  return items.map((item) => ({
    id: item.upload_id,
    uploadId: item.upload_id,
    projectId: item.project_id,
    projectName: item.project_name,
    filename: item.filename,
    contentType: item.content_type,
    status: item.status,
    statusLabel: uploadStatusLabel(item.status),
    statusTone: uploadStatusTone(item.status),
    declaredSizeLabel: formatBytes(item.declared_size),
    sizeLabel: formatBytes(item.size_bytes),
    timestamp: item.created_at,
    relativeTime: formatRelative(item.created_at, now),
    expiresLabel: formatRelative(item.expires_at, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all tickets in scope before the `limit` page is applied.
 */
export function uploadFeedSummary(rows: readonly UploadFeedRow[], total?: number): string {
  if (rows.length === 0) return "No upload tickets";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} tickets · latest: ${latest?.filename ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function uploadFeedGeneratedAtLabel(
  feed: UploadFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Filter-aware empty-state copy for the feed. */
export function uploadFeedEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Upload tickets created for this project will appear here."
    : "Upload tickets will appear here as files are staged for ingestion.";
}
