/**
 * Authoritative workspace activity feed contracts.
 * Mirrors backend/app/schemas/activity.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";

export type ActivityKind = "asset" | "publish" | "job" | "comment";

/** Mirrors the UI BadgeTone union so an event tone can drive a badge directly. */
export type ActivityTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

/** One workspace activity entry (id is `<kind>-<entity-id>`). */
export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  project_id: Uuid;
  actor_id: Uuid;
  label: string;
  detail: string;
  timestamp: Timestamp;
  tone: ActivityTone;
}

/** Newest-first activity feed plus the total matches before limiting. */
export interface ActivityFeed {
  events?: ActivityEvent[];
  total: number;
}
