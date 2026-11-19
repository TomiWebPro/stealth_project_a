/**
 * Display models for the authoritative collaboration feed (C197/C199/C200
 * follow-up). The backend derives the newest-first, workspace-wide feed fresh
 * from the authoritative `PRESENCE` and `COMMENTS` stores — the same collections
 * `/collaboration/stats` aggregates — and the mocks transport mirrors that
 * derivation. A coarse `signal` kind merges both record types onto one wire
 * shape: presence carries its canonical state + last-seen, comments carry a
 * body/optional asset reference + created time.
 *
 * This module only turns the canonical `CollaborationFeed` payload into
 * render-ready rows so the panel JSX stays free of inline mapping and both
 * transports render identically. Every helper tolerates `undefined` (query not
 * settled or failed) and returns render-safe values.
 */

import type { CollaborationFeedOptions } from "../../lib/collaborationFeed";
import type {
  CollaborationFeed,
  CollaborationFeedItem,
  CollaborationSignal,
  PresenceState,
} from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

/** Render-ready row for one collaboration signal in the feed. */
export interface CollaborationFeedRow {
  /** Stable React key; a user can appear as presence in more than one project. */
  readonly id: string;
  readonly signalId: string;
  readonly signal: CollaborationSignal;
  readonly signalLabel: string;
  readonly signalTone: BadgeTone;
  readonly projectId: string;
  readonly projectName: string;
  readonly actorId: string;
  readonly actorLabel: string;
  readonly state: PresenceState | null;
  readonly hasState: boolean;
  readonly stateLabel: string;
  readonly stateTone: BadgeTone;
  readonly body: string;
  readonly bodyPreview: string;
  readonly hasBody: boolean;
  readonly assetId: string | null;
  readonly hasAsset: boolean;
  readonly assetLabel: string;
  readonly timestamp: string;
  readonly relativeTime: string;
}

/** Page-size chips offered above the feed. */
export const COLLABORATION_FEED_LIMITS: readonly number[] = [10, 25, 50];

/** Signal chips offered above the feed; `undefined` is the unfiltered "All" chip. */
export const COLLABORATION_FEED_SIGNAL_FILTERS: readonly (CollaborationSignal | undefined)[] = [
  undefined,
  "presence",
  "comment",
];

const SIGNAL_LABEL: Readonly<Record<CollaborationSignal, string>> = {
  presence: "Presence",
  comment: "Comment",
};

const SIGNAL_TONE: Readonly<Record<CollaborationSignal, BadgeTone>> = {
  presence: "info",
  comment: "accent",
};

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

/** Hook query options from the active project/signal scope and page size. */
export function buildCollaborationFeedOptions(
  projectId: string | undefined,
  signal: CollaborationSignal | undefined,
  limit: number,
): CollaborationFeedOptions {
  return {
    ...(projectId ? { projectId } : {}),
    ...(signal ? { signal } : {}),
    limit,
  };
}

/** Human label for a signal chip (`undefined` is the unfiltered "All" chip). */
export function collaborationSignalChipLabel(signal: CollaborationSignal | undefined): string {
  return signal ? (SIGNAL_LABEL[signal] ?? signal) : "All";
}

/** Badge label/tone for a canonical signal kind with defensive fallbacks. */
export function collaborationSignalLabel(signal: CollaborationSignal): string {
  return SIGNAL_LABEL[signal] ?? signal;
}

export function collaborationSignalTone(signal: CollaborationSignal): BadgeTone {
  return SIGNAL_TONE[signal] ?? "neutral";
}

/** Badge label/tone for a canonical presence state with defensive fallbacks. */
export function presenceStateLabel(state: PresenceState): string {
  return STATE_LABEL[state] ?? state;
}

export function presenceStateTone(state: PresenceState): BadgeTone {
  return STATE_TONE[state] ?? "neutral";
}

/** Compact, render-safe label for an opaque entity id. */
export function shortCollaborationId(value: string, prefix: string): string {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean) return prefix;
  return clean.length > 8 ? `${prefix} ${clean.slice(0, 8)}…` : `${prefix} ${clean}`;
}

/** Single-line, bounded preview for a comment body. */
export function collaborationBodyPreview(body: string | null | undefined, max = 180): string {
  if (typeof body !== "string") return "No comment text";
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return "No comment text";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Map a canonical feed payload to render-ready rows, preserving the wire order
 * (the backend already sorts newest-first by
 * `(occurred_at, signal_id, signal, project_id)`).
 */
export function collaborationFeedRows(
  feed: CollaborationFeed | undefined,
  now: number = Date.now(),
): readonly CollaborationFeedRow[] {
  const items: readonly CollaborationFeedItem[] = feed?.items ?? [];
  return items.map((item) => {
    const signal = item.signal;
    const state = signal === "presence" ? (item.state ?? null) : null;
    const body = signal === "comment" ? (item.body ?? "") : "";
    const assetId = signal === "comment" ? (item.asset_id ?? null) : null;
    return {
      id: `${signal}:${String(item.signal_id)}:${String(item.project_id)}`,
      signalId: String(item.signal_id),
      signal,
      signalLabel: collaborationSignalLabel(signal),
      signalTone: collaborationSignalTone(signal),
      projectId: item.project_id,
      projectName: item.project_name,
      actorId: item.actor_id,
      actorLabel: shortCollaborationId(item.actor_id, "Actor"),
      state,
      hasState: state !== null,
      stateLabel: state ? presenceStateLabel(state) : "",
      stateTone: state ? presenceStateTone(state) : "neutral",
      body,
      bodyPreview: collaborationBodyPreview(body),
      hasBody: Boolean(body),
      assetId,
      hasAsset: Boolean(assetId),
      assetLabel: assetId ? shortCollaborationId(assetId, "Asset") : "",
      timestamp: item.occurred_at,
      relativeTime: formatRelative(item.occurred_at, now),
    };
  });
}

/**
 * Header description derived from the visible rows and the untruncated total.
 * `total` counts all signals in scope before the `limit` page is applied.
 */
export function collaborationFeedSummary(
  rows: readonly CollaborationFeedRow[],
  total?: number,
): string {
  if (rows.length === 0) return "No signals";
  const count = total ?? rows.length;
  const latest = rows[0];
  return `${count} signal${count === 1 ? "" : "s"} · latest in ${latest?.projectName ?? "—"}`;
}

/** Compact "generated at" label for the feed footer. */
export function collaborationFeedGeneratedAtLabel(
  feed: CollaborationFeed | undefined,
  now: number = Date.now(),
): string {
  if (!feed?.generated_at) return "";
  return formatRelative(feed.generated_at, now);
}

/** Scope- and filter-aware empty-state copy for the feed. */
export function collaborationFeedEmptyDescription(
  projectScoped: boolean,
  signalFiltered: boolean,
): string {
  if (signalFiltered) {
    return "No signals match this filter. Try a different signal or clear it.";
  }
  return projectScoped
    ? "Presence and comments in this project will appear here."
    : "Collaboration signals will appear here as teammates interact with projects.";
}
