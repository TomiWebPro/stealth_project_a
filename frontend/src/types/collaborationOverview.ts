/**
 * Authoritative single collaboration-signal overview contracts.
 * Mirrors backend/app/schemas/collaboration_overview.py — do not change one side without the other.
 */

import type { CollaborationFeedItem, CollaborationSignal } from "./collaborationFeed";
import type { PresenceStateCount } from "./collaborationStats";
import type { PresenceState } from "./orchestration";
import type { Timestamp, Uuid } from "./common";

/** Collaboration totals for one signal's project, plus workspace context. */
export interface CollaborationOverviewCounts {
  project_signals: number;
  project_presence: number;
  project_comments: number;
  project_participants: number;
  workspace_signals: number;
  by_state?: PresenceStateCount[];
}

/** A single-collaboration-signal snapshot: identity, context, counts, siblings. */
export interface CollaborationOverview {
  signal_id: Uuid;
  signal: CollaborationSignal;
  project_id: Uuid;
  project_name: string;
  actor_id: Uuid;
  state?: PresenceState | null;
  body?: string | null;
  asset_id?: Uuid | null;
  occurred_at: Timestamp;
  counts: CollaborationOverviewCounts;
  recent_signals?: CollaborationFeedItem[];
  generated_at: Timestamp;
}
