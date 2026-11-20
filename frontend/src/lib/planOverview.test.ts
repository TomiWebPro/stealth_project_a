import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { OrchestrationPlan, OrchestrationRun, Project } from "./types";
import {
  DEFAULT_PLAN_OVERVIEW_RECENT_LIMIT,
  UNKNOWN_PLAN_OVERVIEW_PROJECT_NAME,
  derivePlanOverview,
  planOverviewQueryParams,
  validatePlanOverviewArgs,
} from "./planOverview";

const PLAN_ID = "0b5c1e2a-6100-4000-8000-000000000001";
const PROJECT_ID = "0b5c1e2a-1000-4000-8000-000000000001";
const RUN_A = "0b5c1e2a-6000-4000-8000-000000000001";
const RUN_B = "0b5c1e2a-6000-4000-8000-000000000002";

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

function run(
  runId: string,
  createdAt: string,
  overrides: Partial<OrchestrationRun> = {},
): OrchestrationRun {
  return {
    run_id: runId,
    plan_id: PLAN_ID,
    stage: "await",
    job_ids: ["0b5c1e2a-3000-4000-8000-000000000011"],
    created_at: createdAt,
    ...overrides,
  };
}

describe("derivePlanOverview", () => {
  it("derives identity, whole-scope counts, zero-filled stages and bounded recent runs", () => {
    const overview = derivePlanOverview(
      PLAN_ID,
      [plan()],
      [
        run(RUN_A, "2026-01-02T00:00:00.000Z", { stage: "resolve", job_ids: ["job-a", "job-b"] }),
        run(RUN_B, "2026-01-03T00:00:00.000Z", { stage: "done" }),
      ],
      [project(PROJECT_ID, "Moonshot")],
      REFERENCE_NOW,
      { recentLimit: 2 },
    );

    expect(overview).toEqual({
      plan_id: PLAN_ID,
      project_id: PROJECT_ID,
      project_name: "Moonshot",
      goal: "Generate the s01_c01 shot video.",
      created_at: "2026-01-01T00:00:00.000Z",
      counts: { steps: 2, runs: 2, jobs_linked: 3 },
      by_stage: [
        { stage: "plan", count: 0 },
        { stage: "resolve", count: 1 },
        { stage: "submit", count: 0 },
        { stage: "await", count: 0 },
        { stage: "collect", count: 0 },
        { stage: "done", count: 1 },
      ],
      recent_runs: [
        {
          run_id: RUN_B,
          stage: "done",
          job_count: 1,
          created_at: "2026-01-03T00:00:00.000Z",
        },
        {
          run_id: RUN_A,
          stage: "resolve",
          job_count: 2,
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      generated_at: REFERENCE_NOW,
    });
  });

  it("defaults the recent limit to five and bounds only the recent list", () => {
    const runs = Array.from({ length: 6 }, (_, index) =>
      run(`0b5c1e2a-6000-4000-8000-${String(index).padStart(12, "0")}`,
        `2026-01-0${index + 1}T00:00:00.000Z`),
    );
    const overview = derivePlanOverview(PLAN_ID, [plan()], runs, [project(PROJECT_ID, "Moonshot")], REFERENCE_NOW);

    expect(DEFAULT_PLAN_OVERVIEW_RECENT_LIMIT).toBe(5);
    expect(overview.counts.runs).toBe(6);
    expect(overview.recent_runs).toHaveLength(5);
    // counts stay unbounded while only the recent projection is trimmed
    expect(overview.counts.jobs_linked).toBe(6);
  });

  it("joins runs to the requested plan so orphan runs are never attributed", () => {
    const overview = derivePlanOverview(
      PLAN_ID,
      [plan()],
      [
        run(RUN_A, "2026-01-02T00:00:00.000Z"),
        run(RUN_B, "2026-01-03T00:00:00.000Z", { plan_id: "other-plan" }),
      ],
      [project(PROJECT_ID, "Moonshot")],
      REFERENCE_NOW,
    );

    expect(overview.counts.runs).toBe(1);
    expect(overview.recent_runs?.map((ref) => ref.run_id)).toEqual([RUN_A]);
    expect(overview.by_stage?.find((bucket) => bucket.stage === "done")?.count).toBe(0);
  });

  it("uses the stable unknown-project fallback and tolerates a bare/null-goal plan", () => {
    const overview = derivePlanOverview(
      PLAN_ID,
      [plan({ goal: null, steps: undefined })],
      [],
      [],
      REFERENCE_NOW,
    );

    expect(overview.project_name).toBe(UNKNOWN_PLAN_OVERVIEW_PROJECT_NAME);
    expect(overview.goal).toBeNull();
    expect(overview.counts).toEqual({ steps: 0, runs: 0, jobs_linked: 0 });
    expect(overview.recent_runs).toEqual([]);
    expect(overview.by_stage?.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("throws a normalized 404 for an unknown plan", () => {
    expect(() => derivePlanOverview("missing", [plan()], [], [], REFERENCE_NOW)).toThrow(
      expect.objectContaining({ name: "ApiError", status: 404, code: "plan_not_found" }),
    );
    expect(() => derivePlanOverview("missing", [plan()], [], [], REFERENCE_NOW)).toThrow(ApiError);
  });
});

describe("validatePlanOverviewArgs / planOverviewQueryParams", () => {
  it("rejects a malformed plan id with the shared 422 envelope", () => {
    expect(() => validatePlanOverviewArgs("not-a-uuid")).toThrow(
      expect.objectContaining({
        name: "ApiError",
        status: 422,
        code: "validation_error",
      }),
    );
  });

  it("rejects out-of-range recent limits with the shared 422 envelope", () => {
    for (const recentLimit of [0, 51, 1.5]) {
      expect(() => validatePlanOverviewArgs(PLAN_ID, { recentLimit })).toThrow(
        expect.objectContaining({ status: 422, code: "validation_error" }),
      );
    }
    expect(() => validatePlanOverviewArgs(PLAN_ID, { recentLimit: 5 })).not.toThrow();
    expect(() => validatePlanOverviewArgs(PLAN_ID)).not.toThrow();
  });

  it("forwards the recent limit as a query parameter", () => {
    expect(planOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(planOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
