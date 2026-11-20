import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { Job, OrchestrationPlan, OrchestrationRun, Project } from "./types";
import {
  DEFAULT_RUN_OVERVIEW_RECENT_LIMIT,
  UNKNOWN_RUN_OVERVIEW_PROJECT_NAME,
  deriveRunOverview,
  runOverviewQueryParams,
  validateRunOverviewArgs,
} from "./runOverview";

const RUN_ID = "0b5c1e2a-6000-4000-8000-000000000001";
const PLAN_ID = "0b5c1e2a-6100-4000-8000-000000000001";
const PROJECT_ID = "0b5c1e2a-1000-4000-8000-000000000001";
const JOB_A = "0b5c1e2a-3000-4000-8000-000000000011";
const JOB_B = "0b5c1e2a-3000-4000-8000-000000000012";

function project(id: string, name: string): Project {
  return {
    id,
    org_id: "0b5c1e2a-0000-4000-8000-00000000000a",
    name,
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function plan(overrides: Partial<OrchestrationPlan> = {}): OrchestrationPlan {
  return {
    plan_id: PLAN_ID,
    project_id: PROJECT_ID,
    goal: "Generate the s01_c01 shot video.",
    steps: [
      { step_id: "step-1", operation_id: "image-to-video" },
      { step_id: "step-2", operation_id: "upscale" },
    ],
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function run(overrides: Partial<OrchestrationRun> = {}): OrchestrationRun {
  return {
    run_id: RUN_ID,
    plan_id: PLAN_ID,
    stage: "await",
    job_ids: [JOB_A, JOB_B],
    created_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function job(
  id: string,
  createdAt: string,
  overrides: Partial<Job> = {},
): Job {
  return {
    id,
    project_id: PROJECT_ID,
    operation_id: "image-to-video",
    schema_version: "v1",
    status: "running",
    progress: 0.5,
    result: null,
    error: null,
    attempt: 1,
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: createdAt,
    started_at: createdAt,
    finished_at: null,
    ...overrides,
  };
}

describe("deriveRunOverview", () => {
  it("derives identity, joined context, whole-scope counts, zero-filled statuses and bounded recent jobs", () => {
    const overview = deriveRunOverview(
      RUN_ID,
      [run()],
      [plan()],
      [
        job(JOB_A, "2026-01-02T00:00:00.000Z", { operation_id: "dataset-prep", status: "running", progress: 0.45 }),
        job(JOB_B, "2026-01-03T00:00:00.000Z", { operation_id: "lora-train", status: "succeeded", progress: 1 }),
      ],
      [project(PROJECT_ID, "Moonshot")],
      REFERENCE_NOW,
      { recentLimit: 2 },
    );

    expect(overview).toEqual({
      run_id: RUN_ID,
      plan_id: PLAN_ID,
      project_id: PROJECT_ID,
      project_name: "Moonshot",
      plan_goal: "Generate the s01_c01 shot video.",
      stage: "await",
      created_at: "2026-01-02T00:00:00.000Z",
      counts: { jobs_linked: 2, jobs_resolved: 2, plan_steps: 2 },
      by_status: [
        { status: "queued", count: 0 },
        { status: "running", count: 1 },
        { status: "succeeded", count: 1 },
        { status: "failed", count: 0 },
        { status: "canceled", count: 0 },
      ],
      recent_jobs: [
        {
          job_id: JOB_B,
          operation_id: "lora-train",
          status: "succeeded",
          progress: 1,
          created_at: "2026-01-03T00:00:00.000Z",
        },
        {
          job_id: JOB_A,
          operation_id: "dataset-prep",
          status: "running",
          progress: 0.45,
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      generated_at: REFERENCE_NOW,
    });
  });

  it("collapses duplicate ledger ids and skips unresolved jobs while keeping the declared link count", () => {
    const overview = deriveRunOverview(
      RUN_ID,
      [run({ job_ids: [JOB_A, JOB_A, JOB_B, "unresolved-job"] })],
      [plan()],
      [job(JOB_A, "2026-01-02T00:00:00.000Z")],
      [project(PROJECT_ID, "Moonshot")],
      REFERENCE_NOW,
    );

    // ids are deduplicated (3 unique declared links) but only one resolves
    expect(overview.counts).toEqual({ jobs_linked: 3, jobs_resolved: 1, plan_steps: 2 });
    expect(overview.recent_jobs?.map((ref) => ref.job_id)).toEqual([JOB_A]);
    expect(overview.by_status?.find((bucket) => bucket.status === "running")?.count).toBe(1);
  });

  it("defaults the recent limit to five and bounds only the recent list", () => {
    const jobs = Array.from({ length: 6 }, (_, index) =>
      job(`0b5c1e2a-3000-4000-8000-${String(index).padStart(12, "0")}`,
        `2026-01-0${index + 1}T00:00:00.000Z`),
    );
    const overview = deriveRunOverview(
      RUN_ID,
      [run({ job_ids: jobs.map((candidate) => candidate.id) })],
      [plan()],
      jobs,
      [project(PROJECT_ID, "Moonshot")],
      REFERENCE_NOW,
    );

    expect(DEFAULT_RUN_OVERVIEW_RECENT_LIMIT).toBe(5);
    expect(overview.counts.jobs_linked).toBe(6);
    expect(overview.counts.jobs_resolved).toBe(6);
    expect(overview.recent_jobs).toHaveLength(5);
    expect(overview.by_status?.reduce((total, bucket) => total + bucket.count, 0)).toBe(6);
  });

  it("keeps an orphan run with unknown-project and null-goal fallbacks", () => {
    const overview = deriveRunOverview(
      RUN_ID,
      [run({ plan_id: "missing-plan" })],
      [plan()],
      [],
      [project(PROJECT_ID, "Moonshot")],
      REFERENCE_NOW,
    );

    expect(overview.project_id).toBeNull();
    expect(overview.project_name).toBe(UNKNOWN_RUN_OVERVIEW_PROJECT_NAME);
    expect(overview.plan_goal).toBeNull();
    expect(overview.counts.plan_steps).toBe(0);
    expect(overview.recent_jobs).toEqual([]);
    expect(overview.by_status?.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("throws a normalized 404 for an unknown run", () => {
    expect(() => deriveRunOverview("missing", [run()], [], [], [], REFERENCE_NOW)).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "run_not_found" }),
    );
    expect(() => deriveRunOverview("missing", [run()], [], [], [], REFERENCE_NOW)).toThrow(ApiError);
  });
});

describe("validateRunOverviewArgs / runOverviewQueryParams", () => {
  it("rejects a malformed run id with the shared 422 envelope", () => {
    expect(() => validateRunOverviewArgs("not-a-uuid")).toThrow(
      expect.objectContaining({
        name: "ApiError",
        status: 422,
        code: "validation_error",
      }),
    );
  });

  it("rejects out-of-range recent limits with the shared 422 envelope", () => {
    for (const recentLimit of [0, 51, 1.5]) {
      expect(() => validateRunOverviewArgs(RUN_ID, { recentLimit })).toThrow(
        expect.objectContaining({ status: 422, code: "validation_error" }),
      );
    }
    expect(() => validateRunOverviewArgs(RUN_ID, { recentLimit: 5 })).not.toThrow();
    expect(() => validateRunOverviewArgs(RUN_ID)).not.toThrow();
  });

  it("forwards the recent limit as a query parameter", () => {
    expect(runOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(runOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
