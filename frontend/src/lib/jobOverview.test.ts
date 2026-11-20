import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { Job, JobEvent, Project } from "./types";
import {
  DEFAULT_JOB_OVERVIEW_RECENT_LIMIT,
  deriveJobOverview,
  jobOverviewQueryParams,
  validateJobOverviewArgs,
} from "./jobOverview";
import type { JobOverviewSeeds } from "./jobOverview";

const JOB_A = "0b5c1e2a-3000-4000-8000-000000000001";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    org_id: "0b5c1e2a-0000-4000-8000-00000000000a",
    name: `project-${id}`,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    project_id: PROJECT_A,
    operation_id: "dataset-prep",
    schema_version: "1.0",
    status: "running",
    progress: 0.4,
    attempt: 1,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function event(jobId: string, type: JobEvent["type"], seq: number, timestamp: string): JobEvent {
  return { job_id: jobId, type, seq, timestamp };
}

function seeds(overrides: Partial<JobOverviewSeeds> = {}): JobOverviewSeeds {
  return {
    jobs: [job(JOB_A)],
    events: [],
    retries: [],
    projects: [project(PROJECT_A)],
    now: REFERENCE_NOW,
    ...overrides,
  };
}

describe("deriveJobOverview", () => {
  it("zero-fills counts and the recent-event list with stable identity defaults", () => {
    expect(
      deriveJobOverview(JOB_A, seeds({ jobs: [job(JOB_A, { progress: undefined, attempt: undefined })] })),
    ).toEqual({
      job_id: JOB_A,
      project_id: PROJECT_A,
      project_name: `project-${PROJECT_A}`,
      operation_id: "dataset-prep",
      schema_version: "1.0",
      status: "running",
      progress: 0,
      attempt: 0,
      created_by: CREATOR,
      created_at: "2026-01-01T00:00:00.000Z",
      started_at: null,
      finished_at: null,
      result: null,
      error: null,
      counts: {
        events: 0,
        retries: 0,
        by_event_type: [
          { type: "status", count: 0 },
          { type: "progress", count: 0 },
          { type: "intermediate", count: 0 },
          { type: "result", count: 0 },
          { type: "error", count: 0 },
          { type: "log", count: 0 },
        ],
      },
      recent_events: [],
      generated_at: REFERENCE_NOW,
    });
  });

  it("counts every accepted retry (including duplicates) and skips orphan/malformed ledger entries", () => {
    const overview = deriveJobOverview(
      JOB_A,
      seeds({
        retries: [
          { job_id: JOB_A },
          { job_id: JOB_A },
          { job_id: "0b5c1e2a-3000-4000-8000-0000000000ff" },
          { job_id: "not-a-uuid" },
        ],
      }),
    );
    expect(overview.counts.retries).toBe(2);
  });

  it("derives identity, zero-filled event buckets and newest-first events bounded by the page", () => {
    const overview = deriveJobOverview(
      JOB_A,
      seeds({
        projects: [project(PROJECT_A, { name: "Moonshot" })],
        jobs: [
          job(JOB_A, {
            status: "failed",
            progress: 0.82,
            attempt: 3,
            started_at: "2026-01-01T00:05:00.000Z",
            finished_at: "2026-01-01T00:09:00.000Z",
            error: { code: "TRAIN_OOM", message: "Out of VRAM", retryable: true },
          }),
        ],
        events: [
          event(JOB_A, "status", 0, "2026-01-01T00:00:00.000Z"),
          event(JOB_A, "progress", 1, "2026-01-01T00:01:00.000Z"),
          event(JOB_A, "progress", 2, "2026-01-01T00:02:00.000Z"),
          event(JOB_A, "error", 3, "2026-01-01T00:03:00.000Z"),
          // Same timestamp as seq 3 but lower seq -> sorts after it (stable tie-break).
          event(JOB_A, "log", 4, "2026-01-01T00:03:00.000Z"),
          // Another job's event is excluded.
          event("0b5c1e2a-3000-4000-8000-000000000002", "status", 0, "2026-01-02T00:00:00.000Z"),
        ],
        retries: [{ job_id: JOB_A }],
      }),
      { recentLimit: 2 },
    );

    expect(overview.project_name).toBe("Moonshot");
    expect(overview.status).toBe("failed");
    expect(overview.progress).toBe(0.82);
    expect(overview.attempt).toBe(3);
    expect(overview.started_at).toBe("2026-01-01T00:05:00.000Z");
    expect(overview.finished_at).toBe("2026-01-01T00:09:00.000Z");
    expect(overview.error).toEqual({ code: "TRAIN_OOM", message: "Out of VRAM", retryable: true });
    expect(overview.counts.events).toBe(5);
    expect(overview.counts.retries).toBe(1);
    expect(overview.counts.by_event_type).toEqual([
      { type: "status", count: 1 },
      { type: "progress", count: 2 },
      { type: "intermediate", count: 0 },
      { type: "result", count: 0 },
      { type: "error", count: 1 },
      { type: "log", count: 1 },
    ]);
    expect((overview.recent_events ?? []).map((item) => item.seq)).toEqual([4, 3]);
  });

  it("uses the stable fallback when the job's project is missing", () => {
    expect(deriveJobOverview(JOB_A, seeds({ projects: [] })).project_name).toBe("Unknown project");
  });

  it("throws a normalized 404 for an unknown job", () => {
    expect(() => deriveJobOverview("0b5c1e2a-3000-4000-8000-000000000000", seeds())).toThrow(
      expect.objectContaining({ status: 404, code: "not_found" }),
    );
  });

  it("defaults the recent-event page bound", () => {
    expect(DEFAULT_JOB_OVERVIEW_RECENT_LIMIT).toBe(5);
  });
});

describe("validateJobOverviewArgs", () => {
  it("accepts well-formed ids and in-range limits", () => {
    expect(() => validateJobOverviewArgs(JOB_A)).not.toThrow();
    expect(() => validateJobOverviewArgs(JOB_A, { recentLimit: 1 })).not.toThrow();
    expect(() => validateJobOverviewArgs(JOB_A, { recentLimit: 50 })).not.toThrow();
  });

  it("rejects malformed ids and out-of-range limits with the shared 422 envelope", () => {
    const cases: Array<[string, Record<string, unknown> | undefined]> = [
      ["not-a-uuid", undefined],
      [JOB_A, { recentLimit: 0 }],
      [JOB_A, { recentLimit: 51 }],
      [JOB_A, { recentLimit: 1.5 }],
    ];
    for (const [jobId, options] of cases) {
      expect(() => validateJobOverviewArgs(jobId, options)).toThrow(
        expect.objectContaining({
          name: "ApiError",
          status: 422,
          code: "validation_error",
        }),
      );
    }
    expect(() => validateJobOverviewArgs(JOB_A, { recentLimit: 0 })).toThrow(ApiError);
  });
});

describe("jobOverviewQueryParams", () => {
  it("maps the recent limit to the endpoint query string", () => {
    expect(jobOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(jobOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
