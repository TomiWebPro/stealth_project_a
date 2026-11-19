/**
 * Authoritative per-job execution log contracts.
 * Mirrors backend/app/schemas/job_logs.py — do not change one side without the other.
 */

import type { JobError, JobEventType, JobStatus } from "./operation";
import type { Timestamp, Uuid } from "./common";

/** Coarse console severity derived from an event's type. */
export type LogLevel = "debug" | "info" | "success" | "error";

/** One event from a job's execution stream, projected as a log line. */
export interface JobLogEntry {
  seq: number;
  type: JobEventType;
  level: LogLevel;
  message?: string | null;
  status?: JobStatus | null;
  progress?: number | null;
  asset_id?: Uuid | null;
  error?: JobError | null;
  timestamp: Timestamp;
}

/** A filtered, paginated slice of a job's log with a resume cursor. */
export interface JobLogFrame {
  job_id: Uuid;
  entries?: JobLogEntry[];
  next_seq?: number;
  total?: number;
}
