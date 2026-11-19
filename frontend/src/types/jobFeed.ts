/**
 * Authoritative job feed contracts.
 * Mirrors backend/app/schemas/job_feed.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { JobStatus } from "./operation";

/** One job projected from the authoritative job store. */
export interface JobFeedItem {
  job_id: Uuid;
  project_id: Uuid;
  project_name: string;
  operation_id: string;
  status: JobStatus;
  progress: number;
  attempt: number;
  created_by: Uuid;
  created_at: Timestamp;
  started_at?: Timestamp | null;
  finished_at?: Timestamp | null;
}

/** A bounded, newest-first page of jobs with a whole-scope total. */
export interface JobFeed {
  items?: JobFeedItem[];
  total: number;
  generated_at: Timestamp;
}
