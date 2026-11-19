/**
 * Display models for the authoritative per-job execution log console (C117/
 * C119/C120 follow-up). Every value rendered by `JobLogConsole` is derived here
 * from the raw `JobLogFrame` so empty, partial and populated states stay
 * consistent across mock and live transports and JSX stays free of inline
 * derivation.
 *
 * Helpers tolerate `undefined` frames/entries (query not settled / error / 404)
 * and return render-safe values. The level filter maps directly to the
 * `useJobLogs` query options so switching severity is a single state change.
 */

import type { JobLogsOptions } from "../../lib/jobLogs";
import type { JobEventType, JobLogEntry, JobLogFrame, LogLevel } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";
import { formatRelative } from "../home/format";

/** Severity filter shown in the console: the four levels plus "all". */
export type LogLevelFilter = LogLevel | "all";

export interface LogLevelOption {
  readonly value: LogLevelFilter;
  readonly label: string;
}

export interface JobLogRow {
  readonly seq: number;
  readonly level: LogLevel;
  readonly levelLabel: string;
  readonly levelTone: BadgeTone;
  readonly typeLabel: string;
  readonly timeLabel: string;
  readonly message: string;
  readonly detail: string;
}

const LEVEL_LABELS: Readonly<Record<LogLevel, string>> = {
  debug: "Debug",
  info: "Info",
  success: "Success",
  error: "Error",
};

const LEVEL_TONES: Readonly<Record<LogLevel, BadgeTone>> = {
  debug: "neutral",
  info: "info",
  success: "success",
  error: "danger",
};

const TYPE_LABELS: Readonly<Record<JobEventType, string>> = {
  status: "Status",
  progress: "Progress",
  intermediate: "Intermediate",
  result: "Result",
  error: "Error",
  log: "Log",
};

/** Canonical filter chips in a stable display order. */
export const LOG_LEVEL_FILTERS: readonly LogLevelFilter[] = [
  "all",
  "debug",
  "info",
  "success",
  "error",
];

export function logLevelLabel(level: LogLevel): string {
  return LEVEL_LABELS[level] ?? "Info";
}

export function logLevelTone(level: LogLevel): BadgeTone {
  return LEVEL_TONES[level] ?? "neutral";
}

export function eventTypeLabel(type: JobEventType): string {
  return TYPE_LABELS[type] ?? "Event";
}

export function logLevelFilterLabel(filter: LogLevelFilter): string {
  return filter === "all" ? "All levels" : logLevelLabel(filter);
}

/** Filter chips with their display labels, derived from `LOG_LEVEL_FILTERS`. */
export function logLevelOptions(): readonly LogLevelOption[] {
  return LOG_LEVEL_FILTERS.map((value) => ({ value, label: logLevelFilterLabel(value) }));
}

/**
 * Map a UI severity filter to the query options. "All" omits `level` so the
 * authoritative endpoint returns every event; the cursor and page size are
 * always forwarded so the query key is deterministic.
 */
export function buildJobLogsOptions(
  filter: LogLevelFilter,
  sinceSeq = 0,
  limit = 50,
): JobLogsOptions {
  return {
    ...(filter === "all" ? {} : { level: filter }),
    sinceSeq,
    limit,
  };
}

/**
 * Human message for a log line: prefer the event's own message, then an error
 * payload, then a stable label derived from its type. Never returns empty text.
 */
export function logEntryMessage(entry: JobLogEntry): string {
  const message = typeof entry.message === "string" ? entry.message.trim() : "";
  if (message) return message;
  if (entry.error) {
    return `${entry.error.code}: ${entry.error.message}`.trim();
  }
  return `${eventTypeLabel(entry.type)} event`;
}

/** Extra compact context (progress/status/asset) appended to a log line. */
export function logEntryDetail(entry: JobLogEntry): string {
  const parts: string[] = [];
  if (typeof entry.progress === "number" && Number.isFinite(entry.progress)) {
    parts.push(`progress ${Math.round(Math.min(1, Math.max(0, entry.progress)) * 100)}%`);
  }
  if (entry.status) parts.push(`status ${entry.status}`);
  if (entry.asset_id) parts.push(`asset ${entry.asset_id.slice(0, 8)}`);
  return parts.join(" · ");
}

/** Compact relative timestamp for a log line; empty for a missing/invalid one. */
export function logEntryTimeLabel(
  entry: JobLogEntry,
  now: number = Date.now(),
): string {
  if (typeof entry.timestamp !== "string" || !entry.timestamp) return "";
  return formatRelative(entry.timestamp, now);
}

/** Display rows for a log frame, sorted ascending by sequence number. */
export function logEntryRows(
  entries: readonly JobLogEntry[] | undefined,
  now: number = Date.now(),
): JobLogRow[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => Boolean(entry) && Number.isFinite(entry.seq))
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((entry) => ({
      seq: entry.seq,
      level: entry.level,
      levelLabel: logLevelLabel(entry.level),
      levelTone: logLevelTone(entry.level),
      typeLabel: eventTypeLabel(entry.type),
      timeLabel: logEntryTimeLabel(entry, now),
      message: logEntryMessage(entry),
      detail: logEntryDetail(entry),
    }));
}

/** True when a frame carries at least one renderable log line. */
export function hasLogEntries(frame?: JobLogFrame): boolean {
  return Array.isArray(frame?.entries) && (frame?.entries?.length ?? 0) > 0;
}

/**
 * Compact "showing …" label for the current page, e.g. `Seq 3–5 of 9`.
 * Empty when the page has no entries.
 */
export function logPageLabel(frame?: JobLogFrame): string {
  const entries = frame?.entries;
  if (!Array.isArray(entries) || entries.length === 0) return "";
  const seqs = entries.map((entry) => entry.seq).filter((seq) => Number.isFinite(seq));
  if (seqs.length === 0) return "";
  const first = Math.min(...seqs);
  const last = Math.max(...seqs);
  const total = typeof frame?.total === "number" && Number.isFinite(frame.total) ? frame.total : last;
  return `Seq ${first}–${last} of ${total}`;
}

/**
 * Whether a further page can be loaded. The endpoint exposes a forward cursor
 * but not a maximum sequence, so a full page is the conservative cue that more
 * lines may exist; a partial page means the end was reached.
 */
export function canLoadNewer(frame?: JobLogFrame, limit = 50): boolean {
  return hasLogEntries(frame) && (frame?.entries?.length ?? 0) >= limit;
}

/** Whether stepping back through previously visited cursors is possible. */
export function canLoadOlder(cursorHistory: readonly number[]): boolean {
  return cursorHistory.length > 0;
}

/** Human label for a job in the console picker. */
export function jobOptionLabel(job: { readonly id: string; readonly operation_id: string }): string {
  return `${job.operation_id} · ${job.id.slice(0, 8)}`;
}
