/**
 * Authoritative single-job overview contracts.
 * Mirrors backend/app/schemas/job_overview.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { EventTypeCount } from "./eventStats";
import type { JobError, JobEvent, JobResult, JobStatus } from "./operation";

/** Event/retry totals for one job, derived from the authoritative stores. */
export interface JobOverviewCounts {
  events: number;
  retries: number;
  by_event_type?: EventTypeCount[];
}

/** A single-job snapshot: identity, counts and a few recent events. */
export interface JobOverview {
  job_id: Uuid;
  project_id: Uuid;
  project_name: string;
  operation_id: string;
  schema_version: string;
  status: JobStatus;
  progress: number;
  attempt: number;
  created_by: Uuid;
  created_at: Timestamp;
  started_at?: Timestamp | null;
  finished_at?: Timestamp | null;
  result?: JobResult | null;
  error?: JobError | null;
  counts: JobOverviewCounts;
  recent_events?: JobEvent[];
  generated_at: Timestamp;
}
