/**
 * Authoritative single job-event overview contracts.
 * Mirrors backend/app/schemas/event_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { JobError, JobEvent, JobEventType, JobStatus } from "./operation";
import type { EventTypeCount } from "./eventStats";

/** Whole-job event totals, derived from the authoritative store. */
export interface EventOverviewCounts {
  total: number;
  by_type?: EventTypeCount[];
}

/** A single-event snapshot: identity, context, counts and recent siblings. */
export interface EventOverview {
  job_id: Uuid;
  seq: number;
  type: JobEventType;
  operation_id: string;
  project_id: Uuid;
  project_name: string;
  status?: JobStatus | null;
  progress?: number | null;
  message?: string | null;
  asset_id?: Uuid | null;
  error?: JobError | null;
  timestamp: Timestamp;
  counts: EventOverviewCounts;
  recent_siblings?: JobEvent[];
  generated_at: Timestamp;
}
