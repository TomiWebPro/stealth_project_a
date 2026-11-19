/**
 * Authoritative job event feed contracts.
 * Mirrors backend/app/schemas/event_feed.py — do not change one side without the other.
 */

import type { JobError, JobEventType, JobStatus } from "./operation";
import type { Timestamp, Uuid } from "./common";

/** One job event projected from the authoritative event store. */
export interface EventFeedItem {
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
}

/** A bounded, newest-first page of job events with a whole-scope total. */
export interface EventFeed {
  items?: EventFeedItem[];
  total: number;
  generated_at: Timestamp;
}
