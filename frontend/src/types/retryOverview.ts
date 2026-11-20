/**
 * Authoritative single-retry overview contracts.
 * Mirrors backend/app/schemas/retry_overview.py — do not change one side without the other.
 */

import type { JobStatus } from "./operation";
import type { RetryFeedItem } from "./retryFeed";
import type { Timestamp, Uuid } from "./common";

/** Retry totals derived from the authoritative retry ledger. */
export interface RetryOverviewCounts {
  project_retries: number;
  project_jobs: number;
  total_retries: number;
}

/** A single retried-job snapshot: identity, context, counts and siblings. */
export interface RetryOverview {
  job_id: Uuid;
  project_id: Uuid;
  project_name: string;
  operation_id: string;
  status: JobStatus;
  attempt: number;
  retries: number;
  retried_at: Timestamp;
  counts: RetryOverviewCounts;
  recent_siblings?: RetryFeedItem[];
  generated_at: Timestamp;
}
