/**
 * Authoritative job retry statistics contracts.
 * Mirrors backend/app/schemas/retry_stats.py — do not change one side without the other.
 */

import type { JobStatus } from "./operation";
import type { Timestamp, Uuid } from "./common";

/** Number of retried jobs currently in one lifecycle status. */
export interface RetryStatusCount {
  status: JobStatus;
  jobs: number;
}

/** Retry activity recorded for one project. */
export interface RetryProjectCount {
  project_id: Uuid;
  retries: number;
  jobs: number;
}

/** Job retry metrics derived from the authoritative retry ledger. */
export interface RetryStats {
  total_retries: number;
  total_jobs: number;
  by_status?: RetryStatusCount[];
  by_project?: RetryProjectCount[];
  newest_retry_at?: Timestamp | null;
  generated_at: Timestamp;
}
