import { describe, expect, it } from "vitest";

import {
  deriveOrchestrationStats,
  ORCHESTRATION_STAGES,
  orchestrationStatsQueryParams,
  validateOrchestrationStatsArgs,
} from "./orchestrationStats";
import type { OrchestrationPlan, OrchestrationRun } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const PL1 = "0b5c1e2a-6100-4000-8000-000000000001";
const PL2 = "0b5c1e2a-6100-4000-8000-000000000002";
const PL3 = "0b5c1e2a-6100-4000-8000-000000000003";
const R1 = "0b5c1e2a-6000-4000-8000-000000000001";
const R2 = "0b5c1e2a-6000-4000-8000-000000000002";
const R3 = "0b5c1e2a-6000-4000-8000-000000000003";
const J1 = "0b5c1e2a-3000-4000-8000-000000000011";
const J2 = "0b5c1e2a-3000-4000-8000-000000000012";

function plan(
  planId: string,
  projectId: string,
  createdAt: string,
  stepCount: number,
): OrchestrationPlan {
  return {
    plan_id: planId,
    project_id: projectId,
    goal: "test goal",
    steps: Array.from({ length: stepCount }, (_, index) => ({
      step_id: `step-${planId}-${index}`,
      operation_id: "text-to-image",
    })),
    created_at: createdAt,
  };
}

function run(
  runId: string,
  planId: string,
  stage: OrchestrationRun["stage"],
  createdAt: string,
  jobIds: string[] = [],
): OrchestrationRun {
  return { run_id: runId, plan_id: planId, stage, job_ids: jobIds, created_at: createdAt };
}

describe("deriveOrchestrationStats", () => {
  it("zero-fills every lifecycle stage when both stores are empty", () => {
    expect(deriveOrchestrationStats([], [], NOW)).toEqual({
      total_plans: 0,
      total_runs: 0,
      total_steps: 0,
      total_jobs_linked: 0,
      by_stage: ORCHESTRATION_STAGES.map((stage) => ({ stage, count: 0 })),
      by_project: [],
      newest_plan_at: null,
      newest_run_at: null,
      generated_at: NOW,
    });
  });

  it("derives zero-filled stage counts, project activity, totals and recency", () => {
    // Unsorted input proves the derivation does not depend on store order.
    const stats = deriveOrchestrationStats(
      [
        plan(PL2, P2, "2026-03-18T08:00:00.000Z", 2),
        plan(PL1, P1, "2026-03-18T09:00:00.000Z", 3),
        plan(PL3, P1, "2026-03-18T07:00:00.000Z", 1),
      ],
      [
        run(R2, PL2, "done", "2026-03-18T08:30:00.000Z", [J1]),
        run(R1, PL1, "await", NOW, [J1, J2]),
        run(R3, PL1, "plan", "2026-03-18T09:30:00.000Z"),
      ],
      NOW,
    );

    expect(stats.total_plans).toBe(3);
    expect(stats.total_runs).toBe(3);
    expect(stats.total_steps).toBe(6);
    expect(stats.total_jobs_linked).toBe(3);
    expect(stats.by_stage).toEqual([
      { stage: "plan", count: 1 },
      { stage: "resolve", count: 0 },
      { stage: "submit", count: 0 },
      { stage: "await", count: 1 },
      { stage: "collect", count: 0 },
      { stage: "done", count: 1 },
    ]);
    // P1 has more plans (2 vs 1), so it ranks first; P2 follows with fewer.
    expect(stats.by_project).toEqual([
      { project_id: P1, plans: 2, runs: 2 },
      { project_id: P2, plans: 1, runs: 1 },
    ]);
    expect(stats.newest_plan_at).toBe("2026-03-18T09:00:00.000Z");
    expect(stats.newest_run_at).toBe(NOW);
    expect(stats.generated_at).toBe(NOW);
  });

  it("breaks per-project and recency ties deterministically", () => {
    const plans = [plan(PL1, P1, NOW, 1), plan(PL2, P2, NOW, 1)];
    const runs = [run(R1, PL1, "submit", NOW), run(R2, PL2, "submit", NOW)];
    const forward = deriveOrchestrationStats(plans, runs, NOW);
    expect(forward).toEqual(
      deriveOrchestrationStats([...plans].reverse(), [...runs].reverse(), NOW),
    );
    // Equal plan/run counts: project id breaks the tie (localeCompare).
    expect(forward.by_project).toEqual([
      { project_id: P1, plans: 1, runs: 1 },
      { project_id: P2, plans: 1, runs: 1 },
    ]);
    expect(forward.newest_plan_at).toBe(NOW);
    expect(forward.newest_run_at).toBe(NOW);
  });

  it("scopes the derivation to one project via the run->plan join", () => {
    const plans = [plan(PL1, P1, NOW, 2), plan(PL2, P2, NOW, 1)];
    const runs = [
      run(R1, PL1, "done", NOW, [J1, J2]),
      // A run whose plan is out of scope must be excluded even though its id is known.
      run(R2, PL2, "done", NOW, [J1]),
    ];
    const scoped = deriveOrchestrationStats(plans, runs, NOW, { projectId: P1 });
    expect(scoped.total_plans).toBe(1);
    expect(scoped.total_runs).toBe(1);
    expect(scoped.total_steps).toBe(2);
    expect(scoped.total_jobs_linked).toBe(2);
    expect(scoped.by_project).toEqual([{ project_id: P1, plans: 1, runs: 1 }]);
    expect(scoped.by_stage).toEqual([
      { stage: "plan", count: 0 },
      { stage: "resolve", count: 0 },
      { stage: "submit", count: 0 },
      { stage: "await", count: 0 },
      { stage: "collect", count: 0 },
      { stage: "done", count: 1 },
    ]);

    // A valid but unseeded project yields the zero-filled empty snapshot.
    const empty = deriveOrchestrationStats(plans, runs, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_plans).toBe(0);
    expect(empty.total_runs).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_plan_at).toBeNull();
    expect(empty.newest_run_at).toBeNull();
    expect(empty.by_stage?.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("counts a plans-only project in the by_project breakdown", () => {
    const stats = deriveOrchestrationStats(
      [plan(PL1, P1, NOW, 2), plan(PL2, P2, NOW, 1)],
      [run(R1, PL2, "plan", NOW)],
      NOW,
    );
    expect(stats.by_project).toEqual([
      { project_id: P2, plans: 1, runs: 1 },
      { project_id: P1, plans: 1, runs: 0 },
    ]);
    expect(stats.total_jobs_linked).toBe(0);
  });
});

describe("orchestration stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateOrchestrationStatsArgs()).not.toThrow();
    expect(() => validateOrchestrationStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateOrchestrationStatsArgs({ projectId: "not-a-uuid" });
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
    expect(orchestrationStatsQueryParams()).toEqual({ project_id: undefined });
    expect(orchestrationStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
