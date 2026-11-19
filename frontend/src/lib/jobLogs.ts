/**
 * Authoritative per-job execution log derivation + query helpers (C117
 * follow-up).
 *
 * The backend (`JobLogsRepository`) keeps no second log index: it derives a
 * chronological, severity-filtered, cursor-paginated console view from the same
 * authoritative `JOB_EVENTS` stream the SSE/polling endpoints read. Each event
 * is projected to a `JobLogEntry` with a coarse `LogLevel` derived from its
 * event type. `total` counts every matching entry before paging and `next_seq`
 * is a resume cursor. `lib/jobLogs` reproduces that derivation over the same
 * seeds so mock mode stays at feature parity with live mode and the parity guard
 * can drive both transports over identical data.
 */

import { ApiError } from "../api/client";
import type { JobEvent, JobEventType, JobLogEntry, JobLogFrame, LogLevel } from "./types";

/** Mirrored from the authoritative `/jobs/{job_id}/logs` endpoint. */
export interface JobLogsOptions {
  readonly level?: LogLevel;
  readonly sinceSeq?: number;
  readonly limit?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEVELS: readonly LogLevel[] = ["debug", "info", "success", "error"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Coarse console severity for each canonical event type, mirroring the backend
 * `_LEVEL_BY_TYPE` map. Every type has a mapping so an event can never silently
 * disappear from a filtered log view.
 */
export const LOG_LEVEL_BY_TYPE: Readonly<Record<JobEventType, LogLevel>> = {
  status: "info",
  progress: "debug",
  intermediate: "info",
  result: "success",
  error: "error",
  log: "info",
};

/** Coarse severity for an event type, defaulting to `info` for unknown types. */
export function logLevelForEvent(type: JobEventType): LogLevel {
  return LOG_LEVEL_BY_TYPE[type] ?? "info";
}

/**
 * Mirror the router's validation so mock and live fail identically with the
 * shared normalized error envelope: a malformed path `job_id`, an unknown
 * `level`, a negative `since_seq` or a `limit` outside 1..200 are all rejected
 * with a 422. Unknown-but-valid jobs are checked against the job seeds by the
 * fetch layer and resolve to `undefined`, mirroring the live 404-to-undefined
 * detail-lookup mapping.
 */
export function validateJobLogsArgs(jobId: string, options: JobLogsOptions = {}): void {
  if (!UUID_PATTERN.test(jobId)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid job id.",
      details: [{ field: "job_id", message: "job_id must be a valid UUID" }],
    });
  }
  if (options.level !== undefined && !LEVELS.includes(options.level)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid log level.",
      details: [{ field: "level", message: "level must be debug, info, success or error" }],
    });
  }
  if (options.sinceSeq !== undefined && (!Number.isInteger(options.sinceSeq) || options.sinceSeq < 0)) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Invalid resume cursor.",
      details: [{ field: "since_seq", message: "since_seq must be a non-negative integer" }],
    });
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > MAX_LIMIT)
  ) {
    throw new ApiError({
      status: 422,
      code: "validation_error",
      message: "Log limit must be between 1 and 200.",
      details: [{ field: "limit", message: "limit must be between 1 and 200" }],
    });
  }
}

/**
 * Derive a job's log frame exactly as the backend repository does: project each
 * event to a log line, drop entries whose severity does not match the optional
 * `level` filter, count all matches as `total`, then apply the `sinceSeq` cursor
 * and `limit` page. `next_seq` resumes after the last returned entry (or stays
 * at the cursor for an empty page). An empty stream yields an empty frame, never
 * an error.
 */
export function deriveJobLogs(
  jobId: string,
  events: readonly JobEvent[],
  options: JobLogsOptions = {},
): JobLogFrame {
  const { level, sinceSeq = 0, limit = DEFAULT_LIMIT } = options;
  const matching = events
    .filter((event) => level === undefined || logLevelForEvent(event.type) === level)
    .map<JobLogEntry>((event) => ({
      seq: event.seq,
      type: event.type,
      level: logLevelForEvent(event.type),
      message: event.message ?? null,
      status: event.status ?? null,
      progress: event.progress ?? null,
      asset_id: event.asset_id ?? null,
      error: event.error ?? null,
      timestamp: event.timestamp,
    }))
    .sort((a, b) => a.seq - b.seq);

  const total = matching.length;
  const page = matching.filter((entry) => entry.seq >= sinceSeq).slice(0, limit);
  const nextSeq = page.length > 0 ? (page[page.length - 1]?.seq ?? sinceSeq) + 1 : sinceSeq;
  return { job_id: jobId, entries: page, next_seq: nextSeq, total };
}

/** Query-string values for the live `/jobs/{job_id}/logs` request. */
export function jobLogsQueryParams(
  options: JobLogsOptions = {},
): Record<string, string | number | undefined> {
  return {
    level: options.level,
    since_seq: options.sinceSeq,
    limit: options.limit,
  };
}
