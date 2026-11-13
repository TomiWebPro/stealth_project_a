/**
 * Operation catalog and job lifecycle contracts.
 * Mirrors backend/app/schemas/operation.py.
 */

import type { Metadata, Timestamp, Uuid } from "./common";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type JobEventType =
  | "status"
  | "progress"
  | "intermediate"
  | "result"
  | "error"
  | "log";
export type SettingType = "string" | "number" | "integer" | "boolean" | "enum";

export type SettingDefault = string | number | boolean | null;

/** A user-facing setting exposed by an operation (never raw backend params). */
export interface OperationSetting {
  key: string;
  label: string;
  type: SettingType;
  required?: boolean;
  default?: SettingDefault;
  choices?: string[];
  minimum?: number | null;
  maximum?: number | null;
  description?: string | null;
}

export interface OperationIO {
  asset_types?: string[];
  required?: boolean;
  multiple?: boolean;
}

export interface OperationSpec {
  id: string;
  title: string;
  description?: string | null;
  schema_version: string;
  input?: OperationIO;
  output?: OperationIO;
  settings?: OperationSetting[];
  streaming?: boolean;
  provider_ids?: string[];
}

export interface OperationCatalog {
  version: string;
  operations?: OperationSpec[];
}

/** Submission payload for an operation. */
export interface OperationRequest {
  operation_id: string;
  schema_version: string;
  project_id: Uuid;
  input_asset_ids?: Uuid[];
  prompt?: string | null;
  settings?: Metadata;
  provider_id?: string | null;
  conversation_id?: Uuid | null;
}

export interface JobResult {
  asset_ids?: Uuid[];
  text?: string | null;
  metadata?: Metadata;
}

export interface JobError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface Job {
  id: Uuid;
  project_id: Uuid;
  operation_id: string;
  schema_version: string;
  status: JobStatus;
  progress?: number;
  result?: JobResult | null;
  error?: JobError | null;
  attempt?: number;
  created_by: Uuid;
  created_at: Timestamp;
  started_at?: Timestamp | null;
  finished_at?: Timestamp | null;
}

export interface JobEvent {
  type: JobEventType;
  job_id: Uuid;
  seq: number;
  status?: JobStatus | null;
  progress?: number | null;
  message?: string | null;
  asset_id?: Uuid | null;
  error?: JobError | null;
  timestamp: Timestamp;
}

/** Recoverable stream: resume from the last observed `seq`. */
export interface JobEventFrame {
  job_id: Uuid;
  events?: JobEvent[];
  next_seq?: number;
}

export interface JobListQuery {
  project_id?: Uuid | null;
  status?: JobStatus | null;
  limit?: number;
}

export interface JobCancelRequest {
  reason?: string | null;
}

/** Idempotency key makes retries safe to repeat. */
export interface JobRetryRequest {
  idempotency_key: string;
}
