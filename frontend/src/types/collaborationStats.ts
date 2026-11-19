/**
 * Authoritative collaboration statistics contracts.
 * Mirrors backend/app/schemas/collaboration_stats.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { PresenceState } from "./orchestration";

/** Number of presence records in one canonical state. */
export interface PresenceStateCount {
  state: PresenceState;
  count: number;
}

/** Presence and comment activity recorded for one project. */
export interface CollaborationProjectCount {
  project_id: Uuid;
  comments: number;
  presence: number;
}

/** Collaboration metrics derived from the authoritative presence/comment stores. */
export interface CollaborationStats {
  total_presence: number;
  total_comments: number;
  total_participants: number;
  by_state?: PresenceStateCount[];
  by_project?: CollaborationProjectCount[];
  newest_presence_at?: Timestamp | null;
  newest_comment_at?: Timestamp | null;
  generated_at: Timestamp;
}
