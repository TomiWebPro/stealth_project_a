/**
 * Display models for the authoritative single activity-event overview
 * (C290/C292/C293 follow-up). Every value rendered by `ActivityOverviewPanel` is
 * derived here from the raw `ActivityOverview` snapshot so loading/error/missing/
 * empty/populated states stay consistent across mock and live transports and the
 * JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown event)
 * and return zero-filled, render-safe values. The picker mirrors the newest-first
 * order of the authoritative `useActivity` feed, and the kind distribution reuses
 * the canonical `activityKindRows` projection so this view cannot drift from the
 * workspace activity stats/feed views.
 */

import type { ActivityOverviewOptions } from "../../lib/activityOverview";
import type {
  ActivityEvent,
  ActivityFeed,
  ActivityKind,
  ActivityOverview,
  ActivityStats,
  ActivityTone,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import { ACTIVITY_KIND_LABELS } from "./activityHelpers";
import { activityKindRows, type ActivityKindRow } from "./activityStatsHelpers";

/** Page bound used for the bounded sibling list (counts are never bounded). */
export const ACTIVITY_OVERVIEW_RECENT_LIMIT = 5;

/** Page-size chips offered above the sibling list. */
export const ACTIVITY_OVERVIEW_LIMITS: readonly number[] = [5, 10, 25];

/** Maximum feed rows used to build the picker (mirrors the feed's default page). */
export const ACTIVITY_OVERVIEW_PICKER_LIMIT = 50;

/** `ActivityTone` intentionally mirrors `BadgeTone` one-to-one. */
const BADGE_TONE: Readonly<Record<ActivityTone, BadgeTone>> = {
  neutral: "neutral",
  accent: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

/** Hook query options for the bounded sibling page. */
export function buildActivityOverviewOptions(
  recentLimit: number = ACTIVITY_OVERVIEW_RECENT_LIMIT,
): ActivityOverviewOptions {
  return { recentLimit };
}

/** Hook query options for the authoritative event picker feed. */
export function buildActivityPickerOptions(projectId?: string) {
  return {
    limit: ACTIVITY_OVERVIEW_PICKER_LIMIT,
    ...(projectId ? { projectId } : {}),
  };
}

/** Short relative label for a timestamp, or "" when absent. */
export function activityOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function activityOverviewGeneratedAtLabel(
  overview?: ActivityOverview | null,
  now: number = Date.now(),
): string {
  return activityOverviewRelativeLabel(overview?.generated_at, now);
}

/** Human label for a canonical activity kind, tolerant of an unexpected wire value. */
export function activityOverviewKindLabel(kind?: ActivityKind | null): string {
  return kind ? (ACTIVITY_KIND_LABELS[kind] ?? "Event") : "Event";
}

/** Badge tone for an activity kind (stable, independent of the event's coarse tone). */
export function activityOverviewKindTone(kind?: ActivityKind | null): BadgeTone {
  switch (kind) {
    case "asset":
      return "accent";
    case "publish":
      return "success";
    case "job":
      return "warning";
    case "comment":
      return "info";
    default:
      return "neutral";
  }
}

/** Badge tone for the event's own coarse severity tone. */
export function activityOverviewTone(tone?: ActivityTone | null): BadgeTone {
  return tone ? (BADGE_TONE[tone] ?? "neutral") : "neutral";
}

/** Event count in the selected event's project, zero-filled. */
export function activityOverviewProjectEvents(overview?: ActivityOverview | null): number {
  return nonNegativeCount(overview?.counts?.total_events);
}

/** Distinct participants in the selected event's project, zero-filled. */
export function activityOverviewParticipants(overview?: ActivityOverview | null): number {
  return nonNegativeCount(overview?.counts?.total_participants);
}

/** Whole-workspace event count (never bounded by the sibling page), zero-filled. */
export function activityOverviewWorkspaceEvents(overview?: ActivityOverview | null): number {
  return nonNegativeCount(overview?.counts?.workspace_events);
}

/** Header identity: kind, severity, label/detail, project, actor and recency. */
export interface ActivityOverviewIdentity {
  readonly kindLabel: string;
  readonly kindTone: BadgeTone;
  readonly tone: BadgeTone;
  readonly label: string;
  readonly detail: string;
  readonly projectLabel: string;
  readonly actorLabel: string;
  readonly relativeTime: string;
}

export function activityOverviewIdentity(
  overview?: ActivityOverview | null,
  now: number = Date.now(),
): ActivityOverviewIdentity {
  return {
    kindLabel: activityOverviewKindLabel(overview?.kind),
    kindTone: activityOverviewKindTone(overview?.kind),
    tone: activityOverviewTone(overview?.tone),
    label: overview?.label || "—",
    detail: overview?.detail || "",
    projectLabel: overview?.project_name || "",
    actorLabel: overview?.actor_id || "",
    relativeTime: activityOverviewRelativeLabel(overview?.timestamp, now),
  };
}

export interface ActivityOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

/** The four headline counters, in a stable display order. */
export function activityOverviewStatRows(overview?: ActivityOverview | null): ActivityOverviewStat[] {
  return [
    {
      key: "project-events",
      label: "Project events",
      value: String(activityOverviewProjectEvents(overview)),
      hint: "In this event's project",
    },
    {
      key: "participants",
      label: "Participants",
      value: String(activityOverviewParticipants(overview)),
      hint: "Distinct project actors",
    },
    {
      key: "workspace-events",
      label: "Workspace events",
      value: String(activityOverviewWorkspaceEvents(overview)),
      hint: "Across every project",
    },
    {
      key: "page",
      label: "Siblings shown",
      value: String(overview?.recent_events?.length ?? 0),
      hint: "Bounded newest-first page",
    },
  ];
}

/**
 * Zero-filled asset/publish/job/comment distribution for the event's project.
 * Delegates to the canonical `activityKindRows` projection (labels, tones, order
 * and share bars) so this view cannot drift from `/activity/stats`.
 */
export function activityOverviewKindRows(overview?: ActivityOverview | null): ActivityKindRow[] {
  const stats: ActivityStats = {
    total_events: activityOverviewProjectEvents(overview),
    total_participants: activityOverviewParticipants(overview),
    by_kind: overview?.counts?.by_kind ?? [],
    by_project: [],
    newest_event_at: overview?.timestamp ?? null,
    generated_at: overview?.generated_at ?? "",
  };
  return activityKindRows(stats);
}

/** Newest-first same-project sibling events projected into render-safe rows. */
export interface ActivityOverviewSibling {
  readonly id: string;
  readonly kindLabel: string;
  readonly kindTone: BadgeTone;
  readonly tone: BadgeTone;
  readonly label: string;
  readonly detail: string;
  readonly projectLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
  readonly isCurrent: boolean;
}

export function activityOverviewRecentEvents(
  overview?: ActivityOverview | null,
  now: number = Date.now(),
): ActivityOverviewSibling[] {
  return (overview?.recent_events ?? []).map((event: ActivityEvent) => ({
    id: event.id,
    kindLabel: activityOverviewKindLabel(event.kind),
    kindTone: activityOverviewKindTone(event.kind),
    tone: activityOverviewTone(event.tone),
    label: event.label,
    detail: event.detail,
    projectLabel: overview?.project_name || "",
    timestamp: event.timestamp,
    relativeTime: activityOverviewRelativeLabel(event.timestamp, now),
    isCurrent: event.id === overview?.id,
  }));
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasActivityOverviewData(overview?: ActivityOverview | null): boolean {
  if (!overview) return false;
  return (
    activityOverviewProjectEvents(overview) > 0 ||
    activityOverviewWorkspaceEvents(overview) > 0 ||
    (overview.recent_events?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function activityOverviewSummaryLabel(overview?: ActivityOverview | null): string {
  if (!overview) return "";
  return `${activityOverviewProjectEvents(overview)} events · ${activityOverviewParticipants(overview)} participants`;
}

/** Scope-aware empty-state copy for the event picker. */
export function activityOverviewEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Activity events in this project will appear here."
    : "Asset, publish, job and comment events will appear here as the studio works.";
}

/**
 * Picker options derived from the authoritative activity feed. Each option's
 * value is the event id — the exact `<kind>-<uuid>` key the overview endpoint
 * resolves — and the label previews the kind, event label and recency.
 */
export interface ActivityOverviewPickerOption {
  readonly value: string;
  readonly label: string;
  readonly eventId: string;
}

export function activityOverviewPickerOptions(
  feed: ActivityFeed | undefined,
  now: number = Date.now(),
): ActivityOverviewPickerOption[] {
  return (feed?.events ?? []).map((event: ActivityEvent) => ({
    value: event.id,
    label: `${activityOverviewKindLabel(event.kind)} · ${event.label} · ${activityOverviewRelativeLabel(event.timestamp, now)}`,
    eventId: event.id,
  }));
}

/** Resolve the active picker option, falling back to the first available row. */
export function activityOverviewActiveOption(
  options: readonly ActivityOverviewPickerOption[],
  selectedValue: string,
): ActivityOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}
