/**
 * Authoritative job dispatch-queue contracts.
 * Mirrors backend/app/schemas/job_queue.py — do not change one side without the other.
 */

import type { Timestamp, Uuid } from "./common";
import type { JobStatus } from "./operation";

/** One active job in the dispatch queue, with its FIFO position. */
export interface JobQueueEntry {
  position: number;
  job_id: Uuid;
  operation_id: string;
  status: JobStatus;
  project_id: Uuid;
  created_at: Timestamp;
}

/** A bounded view of the active job queue with whole-queue counters. */
export interface JobQueueView {
  total: number;
  waiting: number;
  running: number;
  entries?: JobQueueEntry[];
  generated_at: Timestamp;
}
