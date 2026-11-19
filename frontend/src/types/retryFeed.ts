/**
 * Authoritative job retry feed contracts.
 * Mirrors backend/app/schemas/retry_feed.py — do not change one side without the other.
 */

import type { JobStatus } from "./operation";
import type { Timestamp, Uuid } from "./common";

/** One retried job projected from the authoritative retry ledger. */
export interface RetryFeedItem {
  job_id: Uuid;
  project_id: Uuid;
  project_name: string;
  operation_id: string;
  status: JobStatus;
  attempt: number;
  retries: number;
  retried_at: Timestamp;
}

/** A bounded, newest-first page of retried jobs with a whole-scope total. */
export interface RetryFeed {
  items?: RetryFeedItem[];
  total: number;
  generated_at: Timestamp;
}
