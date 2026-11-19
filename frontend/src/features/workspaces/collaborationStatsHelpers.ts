/**
 * Display models for the authoritative collaboration statistics
 * (C81/C83/C84 follow-up). Every value rendered by `CollaborationStatsPanel` is
 * derived here from the raw `CollaborationStats` payload so empty, partial and
 * populated states stay consistent across mock and live transports and JSX stays
 * free of inline derivation.
 *
 * All helpers tolerate `undefined` (query not settled / error) and return
 * zero-filled, render-safe values. The presence-state order mirrors the canonical
 * `PRESENCE_STATES` in `lib/collaborationStats` so the UI always shows a complete
 * zero-filled breakdown.
 */

import type {
  CollaborationProjectCount,
  CollaborationStats,
  PresenceState,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

export interface CollaborationStatsCard {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

export interface CollaborationStateRow {
  readonly state: PresenceState;
  readonly label: string;
  readonly count: number;
  /** Rounded share of all scoped presence records, 0..100. */
  readonly percent: number;
  /** Fraction for a compact inline bar, 0..1. */
  readonly fraction: number;
  readonly tone: BadgeTone;
}

export interface CollaborationProjectRow {
  readonly projectId: string;
  readonly label: string;
  readonly comments: number;
  readonly presence: number;
  /** Total collaboration signals (comments + presence) for this project. */
  readonly activity: number;
}

const STATE_ORDER: readonly PresenceState[] = ["online", "away", "offline"];

const STATE_LABEL: Readonly<Record<PresenceState, string>> = {
  online: "Online",
  away: "Away",
  offline: "Offline",
};

const STATE_TONE: Readonly<Record<PresenceState, BadgeTone>> = {
  online: "success",
  away: "warning",
  offline: "neutral",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Compact relative label for a timestamp, or an empty string when absent. */
export function collaborationRelativeLabel(
  value?: string | null,
  now: number = Date.now(),
): string {
  if (!value) return "";
  return formatRelative(value, now);
}

/** Short, stable label for a project id when no friendly name is known. */
export function shortProjectId(projectId: string): string {
  return projectId.length > 8 ? `${projectId.slice(0, 8)}…` : projectId;
}

/** Relative label for the newer of the two authoritative recency signals. */
export function newestSignalLabel(
  stats?: CollaborationStats,
  now: number = Date.now(),
): string {
  const presenceAt = stats?.newest_presence_at;
  const commentAt = stats?.newest_comment_at;
  const presenceMs = presenceAt ? Date.parse(presenceAt) : Number.NaN;
  const commentMs = commentAt ? Date.parse(commentAt) : Number.NaN;
  let newest: string | null | undefined;
  if (Number.isFinite(presenceMs) && Number.isFinite(commentMs)) {
    newest = presenceMs >= commentMs ? presenceAt : commentAt;
  } else if (Number.isFinite(presenceMs)) {
    newest = presenceAt;
  } else if (Number.isFinite(commentMs)) {
    newest = commentAt;
  }
  return collaborationRelativeLabel(newest, now);
}

/** The three authoritative counters plus the newest-activity recency. */
export function collaborationStatsCards(
  stats?: CollaborationStats,
  now: number = Date.now(),
): CollaborationStatsCard[] {
  return [
    {
      key: "presence",
      label: "Presence",
      value: String(stats?.total_presence ?? 0),
      hint: "Recorded sessions",
    },
    {
      key: "comments",
      label: "Comments",
      value: String(stats?.total_comments ?? 0),
      hint: "Project discussions",
    },
    {
      key: "participants",
      label: "Participants",
      value: String(stats?.total_participants ?? 0),
      hint: "Distinct collaborators",
    },
    {
      key: "latest",
      label: "Latest activity",
      value: newestSignalLabel(stats, now) || "—",
      hint: "Most recent signal",
    },
  ];
}

/** Zero-filled online/away/offline distribution with a share per state. */
export function collaborationStateRows(stats?: CollaborationStats): CollaborationStateRow[] {
  const counts = new Map<string, number>();
  for (const entry of stats?.by_state ?? []) {
    if (entry && Number.isFinite(entry.count)) counts.set(entry.state, entry.count);
  }
  const total = STATE_ORDER.reduce((sum, state) => sum + (counts.get(state) ?? 0), 0);
  return STATE_ORDER.map((state) => {
    const count = counts.get(state) ?? 0;
    const fraction = clamp01(total > 0 ? count / total : 0);
    return {
      state,
      label: STATE_LABEL[state] ?? state,
      count,
      fraction,
      percent: Math.round(fraction * 100),
      tone: STATE_TONE[state] ?? "neutral",
    };
  });
}

/**
 * Per-project presence/comment activity with a share of all signals. Rows keep
 * the backend's deterministic (descending comments, presence, then id) order;
 * friendly names are resolved through `projectNames` and fall back to a short id.
 */
export function collaborationProjectRows(
  stats?: CollaborationStats,
  projectNames: Readonly<Record<string, string>> = {},
): CollaborationProjectRow[] {
  return [...(stats?.by_project ?? [])]
    .filter(
      (entry): entry is CollaborationProjectCount =>
        Boolean(entry) && Number.isFinite(entry.comments) && Number.isFinite(entry.presence),
    )
    .sort(
      (a, b) =>
        b.comments - a.comments ||
        b.presence - a.presence ||
        a.project_id.localeCompare(b.project_id),
    )
    .map((entry) => ({
      projectId: entry.project_id,
      label: projectNames[entry.project_id] || shortProjectId(entry.project_id),
      comments: entry.comments,
      presence: entry.presence,
      activity: entry.comments + entry.presence,
    }));
}

/** True when the snapshot carries any presence, comment or participant. */
export function hasCollaborationStatsData(stats?: CollaborationStats): boolean {
  if (!stats) return false;
  return stats.total_presence > 0 || stats.total_comments > 0 || stats.total_participants > 0;
}

/** Compact relative "generated at" label for the snapshot footer. */
export function collaborationStatsGeneratedAtLabel(
  stats?: CollaborationStats,
  now: number = Date.now(),
): string {
  return collaborationRelativeLabel(stats?.generated_at, now);
}
