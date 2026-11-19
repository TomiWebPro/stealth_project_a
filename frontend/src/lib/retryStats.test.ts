import { describe, expect, it } from "vitest";

import {
  JOB_STATUSES,
  deriveRetryStats,
  retryStatsQueryParams,
  validateRetryStatsArgs,
} from "./retryStats";
import type { JobRetryRecord } from "./retryStats";
import type { Job, JobStatus } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const J1 = "0b5c1e2a-3000-4000-8000-000000000001";
const J2 = "0b5c1e2a-3000-4000-8000-000000000002";
const J3 = "0b5c1e2a-3000-4000-8000-000000000003";

function job(
  id: string,
  projectId: string,
  status: JobStatus,
  createdAt: string,
  startedAt?: string,
  finishedAt?: string,
): Job {
  return {
    id,
    project_id: projectId,
    operation_id: "text-to-image",
    schema_version: "v1",
    status,
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: createdAt,
    started_at: startedAt,
    finished_at: finishedAt,
  };
}

function retry(jobId: string): JobRetryRecord {
  return { job_id: jobId };
}

const JOBS = [
  job(J1, P1, "running", "2026-03-18T08:00:00.000Z"),
  job(J2, P2, "failed", "2026-03-18T08:00:00.000Z", "2026-03-18T08:30:00.000Z", "2026-03-18T09:00:00.000Z"),
  job(J3, P2, "succeeded", "2026-03-18T07:00:00.000Z", undefined, "2026-03-18T07:30:00.000Z"),
];

const RETRIES = [retry(J1), retry(J2), retry(J2), retry(J3)];

describe("deriveRetryStats", () => {
  it("zero-fills every status bucket when the retry ledger is empty", () => {
    expect(deriveRetryStats([], [], NOW)).toEqual({
      total_retries: 0,
      total_jobs: 0,
      by_status: JOB_STATUSES.map((status) => ({ status, jobs: 0 })),
      by_project: [],
      newest_retry_at: null,
      generated_at: NOW,
    });
  });

  it("counts duplicate retries per job, zero-fills statuses and finds recency", () => {
    // Unsorted input with an orphan proves recency is a max and orphans are skipped.
    const retries = [retry(J2), retry("0b5c1e2a-3000-4000-8000-0000000000ff"), retry(J3), retry(J2), retry(J1)];
    const stats = deriveRetryStats(retries, JOBS, NOW);

    expect(stats.total_retries).toBe(4);
    expect(stats.total_jobs).toBe(3);
    expect(stats.by_status).toEqual([
      { status: "queued", jobs: 0 },
      { status: "running", jobs: 1 },
      { status: "succeeded", jobs: 1 },
      { status: "failed", jobs: 1 },
      { status: "canceled", jobs: 0 },
    ]);
    // P2 has 3 retries / 2 jobs, P1 has 1 / 1 — descending retries.
    expect(stats.by_project).toEqual([
      { project_id: P2, retries: 3, jobs: 2 },
      { project_id: P1, retries: 1, jobs: 1 },
    ]);
    expect(stats.newest_retry_at).toBe("2026-03-18T09:00:00.000Z");
    expect(stats.generated_at).toBe(NOW);
    expect(deriveRetryStats([...retries].reverse(), JOBS, NOW)).toEqual(stats);
  });

  it("breaks per-project ties by project id", () => {
    const stats = deriveRetryStats([retry(J3), retry(J1)], JOBS, NOW);
    expect(stats.by_project?.map((entry) => entry.project_id)).toEqual([P1, P2]);
  });

  it("scopes retries to one project, skipping orphans, and zero-fills empty scopes", () => {
    const scoped = deriveRetryStats(RETRIES, JOBS, NOW, { projectId: P2 });
    expect(scoped.total_retries).toBe(3);
    expect(scoped.total_jobs).toBe(2);
    expect(scoped.by_project).toEqual([{ project_id: P2, retries: 3, jobs: 2 }]);
    expect(scoped.newest_retry_at).toBe("2026-03-18T09:00:00.000Z");

    const empty = deriveRetryStats(RETRIES, JOBS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_retries).toBe(0);
    expect(empty.total_jobs).toBe(0);
    expect(empty.by_status?.every((bucket) => bucket.jobs === 0)).toBe(true);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_retry_at).toBeNull();
  });
});

describe("retry stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateRetryStatsArgs()).not.toThrow();
    expect(() => validateRetryStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateRetryStatsArgs({ projectId: "not-a-uuid" });
      throw new Error("expected validation to fail");
    } catch (cause) {
      expect(cause).toMatchObject({
        status: 422,
        code: "validation_error",
        details: [{ field: "project_id" }],
      });
    }
  });

  it("maps the project scope onto the live query string", () => {
    expect(retryStatsQueryParams()).toEqual({ project_id: undefined });
    expect(retryStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
