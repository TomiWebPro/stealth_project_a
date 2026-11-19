/**
 * Authoritative collaboration-feed contracts.
 * Mirrors backend/app/schemas/collaboration_feed.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { PresenceState } from "./orchestration";

/** Coarse kind of a collaboration signal. */
export type CollaborationSignal = "presence" | "comment";

/** One collaboration signal projected from the authoritative stores. */
export interface CollaborationFeedItem {
  signal_id: Uuid;
  signal: CollaborationSignal;
  project_id: Uuid;
  project_name: string;
  actor_id: Uuid;
  state?: PresenceState | null;
  body?: string | null;
  asset_id?: Uuid | null;
  occurred_at: Timestamp;
}

/** A bounded, newest-first page of collaboration signals with a whole-scope total. */
export interface CollaborationFeed {
  items?: CollaborationFeedItem[];
  total: number;
  generated_at: Timestamp;
}
