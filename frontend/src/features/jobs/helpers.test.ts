import { describe, expect, it } from "vitest";
import type { Job } from "../../lib/types";
import {
  ALL_JOB_STATUSES,
  canRetryJob,
  groupJobsByStatus,
  jobErrorMessage,
  jobProgressPercent,
  jobStatusLabel,
  summarizeJobs,
} from "./helpers";

function job(status: Job["status"], overrides: Partial<Job> = {}): Job {
  return {
    id: `job-${status}`,
    project_id: "p1",
    operation_id: "dataset-prep",
    schema_version: "v1",
    status,
    created_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("job display helpers", () => {
  it("clamps progress and formats error/retry state", () => {
    expect(jobProgressPercent(job("running", { progress: 0.456 }))).toBe(46);
    expect(jobProgressPercent(job("queued", { progress: 5 }))).toBe(100);
    expect(jobProgressPercent(job("queued", { progress: -1 }))).toBe(0);
    expect(jobErrorMessage(job("failed"))).toBeNull();
    expect(
      jobErrorMessage(job("failed", { error: { code: "E_TIMEOUT", message: "timed out" } })),
    ).toBe("E_TIMEOUT: timed out");
    expect(canRetryJob(job("failed", { error: { code: "E", message: "x", retryable: true } }))).toBe(true);
    expect(canRetryJob(job("failed", { error: { code: "E", message: "x", retryable: false } }))).toBe(false);
  });

  it("handles the empty job set", () => {
    expect(summarizeJobs([])).toBe("No jobs");
    expect(groupJobsByStatus([]).map((group) => group.jobs)).toEqual(
      ALL_JOB_STATUSES.map(() => []),
    );
  });

  it("groups by every status and summarizes the populated set", () => {
    const jobs = [job("running"), job("running"), job("queued"), job("failed")];
    const groups = groupJobsByStatus(jobs);
    expect(groups.map((group) => group.label)).toEqual(ALL_JOB_STATUSES.map(jobStatusLabel));
    expect(groups.find((group) => group.status === "running")?.jobs).toHaveLength(2);
    expect(summarizeJobs(jobs)).toBe("2 running · 1 queued · 1 failed · 4 total");
  });
});
