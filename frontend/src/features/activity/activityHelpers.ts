/**
 * Display models for the authoritative workspace activity feed (C29/C31 follow-up).
 *
 * The backend derives the feed from its authoritative asset / job / comment
 * stores and the mocks transport mirrors that derivation. This module only
 * turns the canonical payload into render-ready rows so the panel's JSX stays
 * free of inline mapping and both transports render identically. Every helper
 * tolerates `undefined` (query not settled / error) and returns render-safe
 * values.
 */

import type { ActivityOptions } from "../../lib/activity";
import type { ActivityEvent, ActivityFeed, ActivityKind, ActivityTone } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface ActivityFeedItem {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly kindLabel: string;
  readonly projectId: string;
  readonly label: string;
  readonly detail: string;
  readonly timestamp: string;
  readonly tone: BadgeTone;
  readonly relativeTime: string;
}

/** `ActivityTone` intentionally mirrors `BadgeTone` one-to-one. */
const BADGE_TONE: Readonly<Record<ActivityTone, BadgeTone>> = {
  neutral: "neutral",
  accent: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export const ACTIVITY_KIND_LABELS: Readonly<Record<ActivityKind, string>> = {
  asset: "Asset",
  publish: "Publish",
  job: "Job",
  comment: "Comment",
};

export interface ActivityKindFilter {
  readonly value: ActivityKind | "all";
  readonly label: string;
}

/** Kind chips shown above the feed; "all" leaves the query unfiltered. */
export const ACTIVITY_KIND_FILTERS: readonly ActivityKindFilter[] = [
  { value: "all", label: "All" },
  { value: "asset", label: "Assets" },
  { value: "publish", label: "Publish" },
  { value: "job", label: "Jobs" },
  { value: "comment", label: "Comments" },
];

/** Map a canonical `ActivityFeed` payload to render-ready rows (already newest-first). */
export function activityFeedItems(
  feed: ActivityFeed | undefined,
  now: number = Date.now(),
): readonly ActivityFeedItem[] {
  const events: readonly ActivityEvent[] = feed?.events ?? [];
  return events.map((event) => ({
    id: event.id,
    kind: event.kind,
    kindLabel: ACTIVITY_KIND_LABELS[event.kind] ?? "Event",
    projectId: event.project_id,
    label: event.label,
    detail: event.detail,
    timestamp: event.timestamp,
    tone: BADGE_TONE[event.tone] ?? "neutral",
    relativeTime: formatRelative(event.timestamp, now),
  }));
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all matches before the limit is applied.
 */
export function activityFeedSummary(
  items: readonly ActivityFeedItem[],
  total?: number,
): string {
  if (items.length === 0) return "No workspace activity";
  const count = total ?? items.length;
  const latest = items[0];
  return `${count} event${count === 1 ? "" : "s"} · latest: ${latest?.label ?? "—"}`;
}

/** Hook query options from the active filter chips; `undefined` means no filters. */
export function buildActivityOptions(
  kind: ActivityKind | "all",
  limit?: number,
): ActivityOptions | undefined {
  const options: ActivityOptions = {
    ...(kind === "all" ? {} : { kind }),
    ...(limit === undefined ? {} : { limit }),
  };
  return Object.keys(options).length > 0 ? options : undefined;
}

/** Filter-aware empty-state copy for the panel. */
export function activityEmptyDescription(kind: ActivityKind | "all"): string {
  return kind === "all"
    ? "Assets, publishes, jobs and comments will appear here as the studio works."
    : `No ${ACTIVITY_KIND_LABELS[kind]?.toLowerCase() ?? ""} events recorded yet.`;
}
