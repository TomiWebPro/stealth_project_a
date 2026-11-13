import type { Job, JobStatus } from "../../lib/types";
import type { BadgeTone } from "../../ui/Badge";

const JOB_STATUS_TONE: Readonly<Record<JobStatus, BadgeTone>> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  canceled: "neutral",
};

const JOB_STATUS_LABEL: Readonly<Record<JobStatus, string>> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

export const ALL_JOB_STATUSES: readonly JobStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
];

export function jobStatusTone(status: JobStatus): BadgeTone {
  return JOB_STATUS_TONE[status];
}

export function jobStatusLabel(status: JobStatus): string {
  return JOB_STATUS_LABEL[status];
}

export function jobProgressPercent(job: Job): number {
  const value = job.progress ?? 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}

export function jobErrorMessage(job: Job): string | null {
  if (!job.error) return null;
  return `${job.error.code}: ${job.error.message}`;
}

export function canRetryJob(job: Job): boolean {
  return job.status === "failed" && job.error?.retryable === true;
}

export function formatJobTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export interface JobGroup {
  readonly status: JobStatus;
  readonly label: string;
  readonly jobs: readonly Job[];
}

export function groupJobsByStatus(jobs: readonly Job[]): readonly JobGroup[] {
  return ALL_JOB_STATUSES.map((status) => ({
    status,
    label: jobStatusLabel(status),
    jobs: jobs.filter((job) => job.status === status),
  }));
}

export function summarizeJobs(jobs: readonly Job[]): string {
  if (jobs.length === 0) return "No jobs";
  const running = jobs.filter((job) => job.status === "running").length;
  const queued = jobs.filter((job) => job.status === "queued").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const parts: string[] = [];
  if (running > 0) parts.push(`${running} running`);
  if (queued > 0) parts.push(`${queued} queued`);
  if (failed > 0) parts.push(`${failed} failed`);
  parts.push(`${jobs.length} total`);
  return parts.join(" · ");
}
