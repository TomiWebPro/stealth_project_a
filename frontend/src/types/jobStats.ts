/**
 * Authoritative job execution statistics contracts.
 * Mirrors backend/app/schemas/job_stats.py — do not change one side without the other.
 */

import type { JobStatus } from "./operation";
import type { Timestamp } from "./common";

/** Number of jobs currently in one lifecycle status. */
export interface JobStatusCount {
  status: JobStatus;
  count: number;
}

/** Job totals and terminal outcomes for one operation id. */
export interface OperationJobStat {
  operation_id: string;
  total: number;
  succeeded: number;
  failed: number;
}

/** Execution metrics derived from the authoritative job store. */
export interface JobStats {
  total: number;
  by_status?: JobStatusCount[];
  by_operation?: OperationJobStat[];
  success_rate?: number;
  in_flight: number;
  completed: number;
  average_duration_seconds?: number | null;
  generated_at: Timestamp;
}
