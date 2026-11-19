/**
 * Authoritative activity statistics contracts.
 * Mirrors backend/app/schemas/activity_stats.py — do not change one side without the other.
 */

import type { ActivityKind } from "./activity";
import type { Timestamp, Uuid } from "./common";

/** Number of activity events of one canonical kind. */
export interface ActivityKindCount {
  kind: ActivityKind;
  count: number;
}

/** Activity recorded for one project. */
export interface ActivityProjectCount {
  project_id: Uuid;
  events: number;
  participants: number;
}

/** Activity metrics derived from the authoritative event stream. */
export interface ActivityStats {
  total_events: number;
  total_participants: number;
  by_kind?: ActivityKindCount[];
  by_project?: ActivityProjectCount[];
  newest_event_at?: Timestamp | null;
  generated_at: Timestamp;
}
