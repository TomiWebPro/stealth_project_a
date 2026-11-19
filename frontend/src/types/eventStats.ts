/**
 * Authoritative job event stream statistics contracts.
 * Mirrors backend/app/schemas/event_stats.py — do not change one side without the other.
 */

import type { JobEventType } from "./operation";
import type { Timestamp, Uuid } from "./common";

/** Number of job events of one canonical event type. */
export interface EventTypeCount {
  type: JobEventType;
  count: number;
}

/** Event activity recorded for one job. */
export interface EventJobCount {
  job_id: Uuid;
  events: number;
  newest_event_at: Timestamp;
}

/** Job event metrics derived from the authoritative event store. */
export interface EventStats {
  total_events: number;
  total_jobs: number;
  by_type?: EventTypeCount[];
  by_job?: EventJobCount[];
  newest_event_at?: Timestamp | null;
  generated_at: Timestamp;
}
