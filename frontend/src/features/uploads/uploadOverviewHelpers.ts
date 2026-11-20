/**
 * Display models for the authoritative single-upload-ticket overview
 * (C246/C248/C249 follow-up). The backend derives the snapshot fresh from the
 * authoritative `UPLOADS` store (joined to `PROJECTS`) — the same store
 * `/uploads/feed` lists and `/uploads/stats` aggregates — and the mocks transport
 * mirrors that derivation. This module only turns the canonical `UploadOverview`
 * payload and the upload feed (used to populate the picker) into render-ready
 * values so `UploadOverviewPanel` stays free of inline mapping and both
 * transports render identically.
 *
 * Every helper tolerates `undefined` (query not settled / failed / unknown
 * ticket) and returns render-safe, zero-filled values. Byte/label formatting and
 * status labels/tones reuse the canonical upload stats/feed helpers so the
 * overview cannot drift from the workspace-wide upload screens.
 */

import type { UploadFeedOptions } from "../../lib/uploadFeed";
import type { UploadFeed, UploadFeedItem, UploadOverview } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import {
  buildUploadFeedOptions,
  uploadFeedEmptyDescription,
} from "./uploadFeedHelpers";
import {
  formatBytes,
  uploadRelativeLabel,
  uploadStatusLabel,
  uploadStatusTone,
} from "./uploadStatsHelpers";

/** Fallback joined project name, matching `lib/uploadOverview`. */
export const UNKNOWN_UPLOAD_OVERVIEW_PROJECT_NAME = "Unknown project";

/** Page size used to populate the upload picker from the authoritative feed. */
export const UPLOAD_OVERVIEW_PICKER_LIMIT = 50;

/** Feed options used to populate the upload picker, optionally project-scoped. */
export function buildUploadPickerFeedOptions(projectId?: string): UploadFeedOptions {
  return buildUploadFeedOptions(projectId, UPLOAD_OVERVIEW_PICKER_LIMIT);
}

/** A render-ready option for the upload-ticket picker. */
export interface UploadPickerOption {
  readonly value: string;
  readonly label: string;
}

/** Compact short id for a ticket, matching the other single-* overview panels. */
export function shortUploadOverviewId(id?: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Compact picker label for one upload feed item. */
export function uploadOptionLabel(item: UploadFeedItem): string {
  const filename = typeof item.filename === "string" && item.filename.trim()
    ? item.filename.trim()
    : "Untitled upload";
  const projectName = item.project_name?.trim() || UNKNOWN_UPLOAD_OVERVIEW_PROJECT_NAME;
  return `${filename} · ${shortUploadOverviewId(item.upload_id)} · ${projectName} · ${uploadStatusLabel(
    item.status,
  )}`;
}

/** Map the authoritative upload feed into deterministic picker options. */
export function uploadPickerOptions(feed?: UploadFeed): readonly UploadPickerOption[] {
  return (feed?.items ?? [])
    .filter((item) => Boolean(item))
    .filter((item) => Boolean(item.upload_id))
    .map((item) => ({ value: item.upload_id, label: uploadOptionLabel(item) }));
}

export interface UploadOverviewIdentity {
  readonly filename: string;
  readonly uploadIdLabel: string;
  readonly projectName: string;
  readonly projectId: string;
  readonly contentType: string;
  readonly statusLabel: string;
  readonly statusTone: BadgeTone;
  readonly expired: boolean;
  readonly createdLabel: string;
  readonly expiresLabel: string;
}

export interface UploadOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface UploadOverviewCountRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

/** Defensive non-negative count for a possibly malformed snapshot field. */
function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or "" when absent. */
export function uploadOverviewRelativeLabel(value?: string | null, now: number = Date.now()): string {
  return uploadRelativeLabel(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function uploadOverviewGeneratedAtLabel(
  overview?: UploadOverview | null,
  now: number = Date.now(),
): string {
  return uploadOverviewRelativeLabel(overview?.generated_at, now);
}

/** Whole-project upload counts, zero-filled for a missing snapshot. */
export function uploadOverviewCounts(overview?: UploadOverview | null): {
  projectTickets: number;
  projectCompleted: number;
  projectBytesUploaded: number;
} {
  return {
    projectTickets: nonNegativeCount(overview?.counts?.project_tickets),
    projectCompleted: nonNegativeCount(overview?.counts?.project_completed),
    projectBytesUploaded: nonNegativeCount(overview?.counts?.project_bytes_uploaded),
  };
}

/**
 * Normalized upload progress for a determinate bar. Falls back to the
 * uploaded/declared byte ratio when the payload progress is absent or invalid.
 */
export function uploadOverviewProgress(overview?: UploadOverview | null): {
  fraction: number;
  percent: number;
} {
  const declared = nonNegativeCount(overview?.declared_size);
  const uploaded = nonNegativeCount(overview?.size_bytes);
  const raw =
    typeof overview?.progress === "number" && Number.isFinite(overview.progress)
      ? overview.progress
      : declared > 0
        ? uploaded / declared
        : 0;
  const fraction = clamp01(raw);
  return { fraction, percent: Math.round(fraction * 100) };
}

/** Identity, joined project context and lifecycle for the snapshot header. */
export function uploadOverviewIdentity(
  overview?: UploadOverview | null,
  now: number = Date.now(),
): UploadOverviewIdentity {
  const filename = typeof overview?.filename === "string" ? overview.filename.trim() : "";
  const contentType =
    typeof overview?.content_type === "string" ? overview.content_type.trim() : "";
  return {
    filename: filename || "Untitled upload",
    uploadIdLabel: shortUploadOverviewId(overview?.upload_id),
    projectName: overview?.project_name?.trim() || UNKNOWN_UPLOAD_OVERVIEW_PROJECT_NAME,
    projectId: overview?.project_id ?? "",
    contentType: contentType || "Unknown type",
    statusLabel: overview?.status ? uploadStatusLabel(overview.status) : "Ticket",
    statusTone: overview?.status ? uploadStatusTone(overview.status) : "neutral",
    expired: Boolean(overview?.expired),
    createdLabel: uploadOverviewRelativeLabel(overview?.created_at, now),
    expiresLabel: uploadOverviewRelativeLabel(overview?.expires_at, now),
  };
}

/** Headline byte-accounting cards for this ticket. */
export function uploadOverviewStatRows(overview?: UploadOverview | null): UploadOverviewStat[] {
  const progress = uploadOverviewProgress(overview);
  return [
    {
      key: "declared",
      label: "Declared",
      value: formatBytes(overview?.declared_size),
      hint: "Declared size",
    },
    {
      key: "uploaded",
      label: "Uploaded",
      value: formatBytes(overview?.size_bytes),
      hint: "Bytes received",
    },
    {
      key: "remaining",
      label: "Remaining",
      value: formatBytes(overview?.bytes_remaining),
      hint: "Bytes outstanding",
    },
    {
      key: "progress",
      label: "Progress",
      value: `${progress.percent}%`,
      hint: "Completion",
    },
  ];
}

/** Whole-project activity rows for the ticket's project (counts never bounded). */
export function uploadOverviewCountRows(
  overview?: UploadOverview | null,
): UploadOverviewCountRow[] {
  const counts = uploadOverviewCounts(overview);
  return [
    {
      key: "project-tickets",
      label: "Project tickets",
      value: String(counts.projectTickets),
      hint: "All tickets in this project",
    },
    {
      key: "project-completed",
      label: "Completed",
      value: String(counts.projectCompleted),
      hint: "Completed tickets",
    },
    {
      key: "project-bytes",
      label: "Project bytes",
      value: formatBytes(counts.projectBytesUploaded),
      hint: "Uploaded across the project",
    },
  ];
}

/** One-line summary for the panel footer. */
export function uploadOverviewSummaryLabel(overview?: UploadOverview | null): string {
  if (!overview) return "";
  const identity = uploadOverviewIdentity(overview, 0);
  const progress = uploadOverviewProgress(overview);
  return `${identity.filename} · ${identity.projectName} · ${identity.statusLabel} · ${progress.percent}% complete`;
}

/** Filter-aware empty-state copy for the picker, reusing the feed's wording. */
export function uploadOverviewEmptyDescription(projectScoped: boolean): string {
  return uploadFeedEmptyDescription(projectScoped);
}

/** False only when the snapshot is missing or carries no recorded activity. */
export function hasUploadOverviewData(overview?: UploadOverview | null): boolean {
  if (!overview) return false;
  const counts = uploadOverviewCounts(overview);
  return (
    counts.projectTickets > 0 ||
    nonNegativeCount(overview.declared_size) > 0 ||
    nonNegativeCount(overview.size_bytes) > 0
  );
}
