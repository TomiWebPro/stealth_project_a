/**
 * Authoritative single activity event overview contracts.
 * Mirrors backend/app/schemas/activity_overview.py — do not change one side without the other.
 */

import type { ActivityEvent, ActivityKind, ActivityTone } from "./activity";
import type { ActivityKindCount } from "./activityStats";
import type { Timestamp, Uuid } from "./common";

/** Activity totals for one event's project, plus workspace context. */
export interface ActivityOverviewCounts {
  total_events: number;
  total_participants: number;
  workspace_events: number;
  by_kind?: ActivityKindCount[];
}

/** A single-activity snapshot: identity, context, counts and recent siblings. */
export interface ActivityOverview {
  id: string;
  kind: ActivityKind;
  project_id: Uuid;
  project_name: string;
  actor_id: Uuid;
  label: string;
  detail: string;
  timestamp: Timestamp;
  tone: ActivityTone;
  counts: ActivityOverviewCounts;
  recent_events?: ActivityEvent[];
  generated_at: Timestamp;
}
