import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { UNKNOWN_RETRY_PROJECT_NAME } from "./retryFeed";
import type { Job, JobStatus, Project } from "./types";
import {
  DEFAULT_RETRY_OVERVIEW_RECENT_LIMIT,
  deriveRetryOverview,
  retryOverviewQueryParams,
  validateRetryOverviewArgs,
} from "./retryOverview";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const J1 = "0b5c1e2a-3000-4000-8000-000000000001";
const J2 = "0b5c1e2a-3000-4000-8000-000000000002";
const J3 = "0b5c1e2a-3000-4000-8000-000000000003";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
];

function job(
  id: string,
  projectId: string,
  status: JobStatus,
  attempt: number,
  createdAt: string,
  startedAt: string | null = null,
  finishedAt: string | null = null,
): Job {
  return {
    id,
    project_id: projectId,
    operation_id: "lora-train",
    schema_version: "1.0",
    status,
    attempt,
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: createdAt,
    started_at: startedAt,
    finished_at: finishedAt,
  };
}

const JOBS: readonly Job[] = [
  job(J1, P1, "running", 2, "2026-03-18T08:00:00.000Z", "2026-03-18T08:05:00.000Z"),
  job(J2, P1, "failed", 3, "2026-03-18T09:00:00.000Z", "2026-03-18T09:10:00.000Z", "2026-03-18T09:20:00.000Z"),
  job(J3, P2, "succeeded", 2, "2026-03-18T07:00:00.000Z"),
];

// One ledger row per accepted retry; J1 was retried twice, the last entry is an orphan.
const RETRIES = [
  { job_id: J1 },
  { job_id: J1 },
  { job_id: J2 },
  { job_id: J3 },
  { job_id: "0b5c1e2a-3000-4000-8000-0000000000ff" },
];

const SEEDS = { retries: RETRIES, jobs: JOBS, projects: PROJECTS, now: NOW };

describe("deriveRetryOverview", () => {
  it("derives identity, joined project, whole-scope counts and newest-first siblings", () => {
    const overview = deriveRetryOverview(J1, SEEDS);

    expect(overview).toMatchObject({
      job_id: J1,
      project_id: P1,
      project_name: "Moonshot",
      operation_id: "lora-train",
      status: "running",
      attempt: 2,
      retries: 2,
      retried_at: "2026-03-18T08:05:00.000Z",
      counts: {
        project_retries: 3,
        project_jobs: 2,
        total_retries: 4,
      },
      generated_at: NOW,
    });
    // Siblings are same-project, newest-first, include the target and exclude orphans.
    expect(overview.recent_siblings?.map((item) => item.job_id)).toEqual([J2, J1]);
    expect(overview.recent_siblings?.[0]).toMatchObject({
      project_name: "Moonshot",
      retries: 1,
      retried_at: "2026-03-18T09:20:00.000Z",
    });
  });

  it("bounds the sibling page by recentLimit without bounding the counts", () => {
    const overview = deriveRetryOverview(J1, SEEDS, { recentLimit: 1 });

    expect(overview.recent_siblings).toHaveLength(1);
    expect(overview.recent_siblings?.[0]?.job_id).toBe(J2);
    expect(overview.counts).toEqual({
      project_retries: 3,
      project_jobs: 2,
      total_retries: 4,
    });
  });

  it("uses the unknown-project fallback for an orphan project", () => {
    const orphanProject = "00000000-0000-4000-8000-000000000000";
    const seeds = {
      ...SEEDS,
      jobs: [job(J1, orphanProject, "running", 2, "2026-03-18T08:00:00.000Z")],
      projects: [],
    };
    const overview = deriveRetryOverview(J1, seeds);

    expect(overview.project_name).toBe(UNKNOWN_RETRY_PROJECT_NAME);
    expect(overview.recent_siblings?.[0]?.project_name).toBe(UNKNOWN_RETRY_PROJECT_NAME);
  });

  it("throws a job_not_found 404 for an unknown job", () => {
    try {
      deriveRetryOverview("00000000-0000-4000-8000-000000000000", SEEDS);
      throw new Error("expected derivation to fail");
    } catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      expect(cause).toMatchObject({ status: 404, code: "job_not_found" });
    }
  });

  it("throws a retry_not_found 404 for a job with no accepted retries", () => {
    const neverRetried = "0b5c1e2a-3000-4000-8000-000000000009";
    const seeds = {
      ...SEEDS,
      jobs: [...JOBS, job(neverRetried, P1, "queued", 1, "2026-03-18T08:00:00.000Z")],
    };
    try {
      deriveRetryOverview(neverRetried, seeds);
      throw new Error("expected derivation to fail");
    } catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      expect(cause).toMatchObject({ status: 404, code: "retry_not_found" });
    }
  });
});

describe("validateRetryOverviewArgs", () => {
  it("accepts a valid id and default options", () => {
    expect(() => validateRetryOverviewArgs(J1)).not.toThrow();
    expect(() =>
      validateRetryOverviewArgs(J1, { recentLimit: DEFAULT_RETRY_OVERVIEW_RECENT_LIMIT }),
    ).not.toThrow();
  });

  it.each(["not-a-uuid", "oops"])("rejects a malformed job id (%s)", (jobId) => {
    expect(() => validateRetryOverviewArgs(jobId)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it.each([0, 51, -1, 1.5])("rejects an out-of-range recentLimit (%s)", (recentLimit) => {
    expect(() => validateRetryOverviewArgs(J1, { recentLimit })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("retryOverviewQueryParams", () => {
  it("maps the recent limit to the live query param", () => {
    expect(retryOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(retryOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
