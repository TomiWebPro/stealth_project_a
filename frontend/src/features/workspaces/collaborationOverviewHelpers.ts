/**
 * Display models for the authoritative single collaboration-signal overview
 * (C294/C296/C297 follow-up). Every value rendered by `CollaborationOverviewPanel`
 * is derived here from the raw `CollaborationOverview` snapshot so loading/error/
 * missing/empty/populated states stay consistent across mock and live transports
 * and the JSX stays free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error / unknown signal)
 * and return zero-filled, render-safe values. The picker mirrors the newest-first
 * order of the authoritative `useCollaborationFeed` and each option's value is the
 * exact composite `<signal>:<project-id>:<signal-id>` key the overview endpoint
 * resolves. The presence-state distribution and signal/state labels reuse the
 * canonical collaboration feed/stats helpers so this view cannot drift from the
 * workspace feed or stats views.
 */

import {
  buildCollaborationSignalKey,
  type CollaborationOverviewOptions,
} from "../../lib/collaborationOverview";
import type { CollaborationFeedOptions } from "../../lib/collaborationFeed";
import type {
  CollaborationFeed,
  CollaborationFeedItem,
  CollaborationOverview,
  CollaborationSignal,
  PresenceState,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";
import {
  collaborationBodyPreview,
  collaborationSignalLabel,
  collaborationSignalTone,
  presenceStateLabel,
  presenceStateTone,
  shortCollaborationId,
} from "./collaborationFeedHelpers";
import { collaborationStateRows, type CollaborationStateRow } from "./collaborationStatsHelpers";

/** Page bound used for the bounded sibling list (counts are never bounded). */
export const COLLABORATION_OVERVIEW_RECENT_LIMIT = 5;

/** Page-size chips offered above the sibling list. */
export const COLLABORATION_OVERVIEW_LIMITS: readonly number[] = [5, 10, 25];

/** Maximum feed rows used to build the picker (mirrors the feed's default page). */
export const COLLABORATION_OVERVIEW_PICKER_LIMIT = 50;

function nonNegativeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

/** Hook query options for the bounded sibling page. */
export function buildCollaborationOverviewOptions(
  recentLimit: number = COLLABORATION_OVERVIEW_RECENT_LIMIT,
): CollaborationOverviewOptions {
  return { recentLimit };
}

/** Hook query options for the authoritative signal picker feed. */
export function buildCollaborationOverviewPickerOptions(
  projectId?: string,
): CollaborationFeedOptions {
  return {
    limit: COLLABORATION_OVERVIEW_PICKER_LIMIT,
    ...(projectId ? { projectId } : {}),
  };
}

/** Short relative label for a timestamp, or "" when absent. */
export function collaborationOverviewRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Relative label for when the snapshot was generated (footer), or "". */
export function collaborationOverviewGeneratedAtLabel(
  overview?: CollaborationOverview | null,
  now: number = Date.now(),
): string {
  return collaborationOverviewRelativeLabel(overview?.generated_at, now);
}

/** Human label for a canonical signal kind with an unexpected-wire fallback. */
export function collaborationOverviewSignalLabel(signal?: CollaborationSignal | null): string {
  return signal ? collaborationSignalLabel(signal) : "Signal";
}

/** Badge tone for a canonical signal kind. */
export function collaborationOverviewSignalTone(signal?: CollaborationSignal | null): BadgeTone {
  return signal ? collaborationSignalTone(signal) : "neutral";
}

/** Human label for a canonical presence state with an unexpected-wire fallback. */
export function collaborationOverviewStateLabel(state?: PresenceState | null): string {
  return state ? presenceStateLabel(state) : "";
}

/** Badge tone for a canonical presence state. */
export function collaborationOverviewStateTone(state?: PresenceState | null): BadgeTone {
  return state ? presenceStateTone(state) : "neutral";
}

/** All signals in the selected signal's project, zero-filled. */
export function collaborationOverviewProjectSignals(
  overview?: CollaborationOverview | null,
): number {
  return nonNegativeCount(overview?.counts?.project_signals);
}

/** Presence signals in the selected signal's project, zero-filled. */
export function collaborationOverviewProjectPresence(
  overview?: CollaborationOverview | null,
): number {
  return nonNegativeCount(overview?.counts?.project_presence);
}

/** Comment signals in the selected signal's project, zero-filled. */
export function collaborationOverviewProjectComments(
  overview?: CollaborationOverview | null,
): number {
  return nonNegativeCount(overview?.counts?.project_comments);
}

/** Distinct participants in the selected signal's project, zero-filled. */
export function collaborationOverviewProjectParticipants(
  overview?: CollaborationOverview | null,
): number {
  return nonNegativeCount(overview?.counts?.project_participants);
}

/** Whole-workspace signal count (never bounded by the sibling page), zero-filled. */
export function collaborationOverviewWorkspaceSignals(
  overview?: CollaborationOverview | null,
): number {
  return nonNegativeCount(overview?.counts?.workspace_signals);
}

/** A signal's one-line payload detail: presence state label or comment body preview. */
export function collaborationOverviewSignalDetail(
  signal?: CollaborationSignal | null,
  state?: PresenceState | null,
  body?: string | null,
): string {
  if (signal === "presence") return collaborationOverviewStateLabel(state);
  if (signal === "comment") return collaborationBodyPreview(body);
  return "";
}

/** Header identity: signal, state/detail, project, actor and recency. */
export interface CollaborationOverviewIdentity {
  readonly signalLabel: string;
  readonly signalTone: BadgeTone;
  readonly hasState: boolean;
  readonly stateLabel: string;
  readonly stateTone: BadgeTone;
  readonly detail: string;
  readonly projectLabel: string;
  readonly actorLabel: string;
  readonly relativeTime: string;
}

export function collaborationOverviewIdentity(
  overview?: CollaborationOverview | null,
  now: number = Date.now(),
): CollaborationOverviewIdentity {
  const state = overview?.signal === "presence" ? (overview.state ?? null) : null;
  return {
    signalLabel: collaborationOverviewSignalLabel(overview?.signal),
    signalTone: collaborationOverviewSignalTone(overview?.signal),
    hasState: state !== null,
    stateLabel: collaborationOverviewStateLabel(state),
    stateTone: collaborationOverviewStateTone(state),
    detail: collaborationOverviewSignalDetail(overview?.signal, overview?.state, overview?.body),
    projectLabel: overview?.project_name || "",
    actorLabel: shortCollaborationId(overview?.actor_id ?? "", "Actor"),
    relativeTime: collaborationOverviewRelativeLabel(overview?.occurred_at, now),
  };
}

export interface CollaborationOverviewStat {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

/** The four headline counters, in a stable display order. */
export function collaborationOverviewStatRows(
  overview?: CollaborationOverview | null,
): CollaborationOverviewStat[] {
  return [
    {
      key: "project-signals",
      label: "Project signals",
      value: String(collaborationOverviewProjectSignals(overview)),
      hint: "In this signal's project",
    },
    {
      key: "participants",
      label: "Participants",
      value: String(collaborationOverviewProjectParticipants(overview)),
      hint: "Distinct project actors",
    },
    {
      key: "workspace-signals",
      label: "Workspace signals",
      value: String(collaborationOverviewWorkspaceSignals(overview)),
      hint: "Across every project",
    },
    {
      key: "page",
      label: "Siblings shown",
      value: String(overview?.recent_signals?.length ?? 0),
      hint: "Bounded newest-first page",
    },
  ];
}

/**
 * Zero-filled online/away/offline distribution for the signal's project.
 * Delegates to the canonical `collaborationStateRows` projection (labels, tones,
 * order and share bars) so this view cannot drift from `/collaboration/stats`.
 */
export function collaborationOverviewStateRows(
  overview?: CollaborationOverview | null,
): CollaborationStateRow[] {
  return collaborationStateRows({
    total_presence: collaborationOverviewProjectPresence(overview),
    total_comments: collaborationOverviewProjectComments(overview),
    total_participants: collaborationOverviewProjectParticipants(overview),
    by_state: overview?.counts?.by_state ?? [],
    generated_at: overview?.generated_at ?? "",
  });
}

/** Newest-first same-project sibling signals projected into render-safe rows. */
export interface CollaborationOverviewSibling {
  readonly id: string;
  readonly signalLabel: string;
  readonly signalTone: BadgeTone;
  readonly hasState: boolean;
  readonly stateLabel: string;
  readonly stateTone: BadgeTone;
  readonly detail: string;
  readonly actorLabel: string;
  readonly projectLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
  readonly isCurrent: boolean;
}

export function collaborationOverviewRecentSignals(
  overview?: CollaborationOverview | null,
  now: number = Date.now(),
): CollaborationOverviewSibling[] {
  const currentKey = overview
    ? buildCollaborationSignalKey(overview.signal, overview.project_id, overview.signal_id)
    : "";
  return (overview?.recent_signals ?? []).map((item: CollaborationFeedItem) => {
    const state = item.signal === "presence" ? (item.state ?? null) : null;
    return {
      id: buildCollaborationSignalKey(item.signal, item.project_id, item.signal_id),
      signalLabel: collaborationOverviewSignalLabel(item.signal),
      signalTone: collaborationOverviewSignalTone(item.signal),
      hasState: state !== null,
      stateLabel: collaborationOverviewStateLabel(state),
      stateTone: collaborationOverviewStateTone(state),
      detail: collaborationOverviewSignalDetail(item.signal, item.state, item.body),
      actorLabel: shortCollaborationId(item.actor_id, "Actor"),
      projectLabel: item.project_name || overview?.project_name || "",
      timestamp: item.occurred_at,
      relativeTime: collaborationOverviewRelativeLabel(item.occurred_at, now),
      isCurrent:
        buildCollaborationSignalKey(item.signal, item.project_id, item.signal_id) === currentKey,
    };
  });
}

/** False only when the snapshot is missing or entirely zero-filled/empty. */
export function hasCollaborationOverviewData(overview?: CollaborationOverview | null): boolean {
  if (!overview) return false;
  return (
    collaborationOverviewProjectSignals(overview) > 0 ||
    collaborationOverviewWorkspaceSignals(overview) > 0 ||
    (overview.recent_signals?.length ?? 0) > 0
  );
}

/** One-line summary for the panel header/footer. */
export function collaborationOverviewSummaryLabel(
  overview?: CollaborationOverview | null,
): string {
  if (!overview) return "";
  return `${collaborationOverviewProjectSignals(overview)} signals · ${collaborationOverviewProjectParticipants(overview)} participants`;
}

/** Scope-aware empty-state copy for the signal picker. */
export function collaborationOverviewEmptyDescription(projectScoped: boolean): string {
  return projectScoped
    ? "Presence and comment signals in this project will appear here."
    : "Presence and comment signals will appear here as teammates interact with projects.";
}

/**
 * Picker options derived from the authoritative collaboration feed. Each option's
 * value is the composite `<signal>:<project-id>:<signal-id>` key the overview
 * endpoint resolves, and the label previews the signal kind, payload, project and
 * recency.
 */
export interface CollaborationOverviewPickerOption {
  readonly value: string;
  readonly label: string;
  readonly signalKey: string;
}

export function collaborationOverviewPickerOptions(
  feed: CollaborationFeed | undefined,
  now: number = Date.now(),
): CollaborationOverviewPickerOption[] {
  return (feed?.items ?? []).map((item: CollaborationFeedItem) => {
    const signalKey = buildCollaborationSignalKey(item.signal, item.project_id, item.signal_id);
    const detail = collaborationOverviewSignalDetail(item.signal, item.state, item.body);
    const label = [
      collaborationOverviewSignalLabel(item.signal),
      detail || item.project_name || "—",
      collaborationOverviewRelativeLabel(item.occurred_at, now),
    ]
      .filter(Boolean)
      .join(" · ");
    return { value: signalKey, label, signalKey };
  });
}

/** Resolve the active picker option, falling back to the first available row. */
export function collaborationOverviewActiveOption(
  options: readonly CollaborationOverviewPickerOption[],
  selectedValue: string,
): CollaborationOverviewPickerOption | undefined {
  return options.find((option) => option.value === selectedValue) ?? options[0];
}
