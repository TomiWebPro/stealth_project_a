import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { OrchestrationPlan, OrchestrationRun } from "./types";
import {
  deriveOrchestrationFeed,
  orchestrationFeedQueryParams,
  validateOrchestrationFeedArgs,
} from "./orchestrationFeed";

const NOW = "2026-11-19T12:00:00Z";

const projects = [
  { id: "project-a", name: "Project Alpha" },
  { id: "project-b", name: "Project Beta" },
];

const plans: OrchestrationPlan[] = [
  {
    plan_id: "plan-new",
    project_id: "project-a",
    goal: "Newest plan goal",
    steps: [{ step_id: "s1", operation_id: "text-to-image" }],
    created_at: "2026-01-05T00:00:00Z",
  },
  {
    plan_id: "plan-old",
    project_id: "project-b",
    steps: [
      { step_id: "s1", operation_id: "dataset-prep" },
      { step_id: "s2", operation_id: "lora-train" },
    ],
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    plan_id: "plan-missing-project",
    project_id: "missing-project",
    created_at: "2026-01-03T00:00:00Z",
  },
];

const runs: OrchestrationRun[] = [
  {
    run_id: "run-1",
    plan_id: "plan-new",
    stage: "await",
    job_ids: ["job-1", "job-2"],
    created_at: "2026-01-04T00:00:00Z",
  },
  {
    run_id: "run-2",
    plan_id: "plan-old",
    stage: "done",
    job_ids: ["job-3"],
    created_at: "2026-01-02T00:00:00Z",
  },
  {
    run_id: "run-orphan",
    plan_id: "plan-does-not-exist",
    stage: "plan",
    job_ids: ["job-x"],
    created_at: "2026-01-06T00:00:00Z",
  },
];

describe("deriveOrchestrationFeed", () => {
  it("projects plans and runs newest-first with joined names and work counts", () => {
    const feed = deriveOrchestrationFeed(plans, runs, projects, NOW);
    expect(feed.total).toBe(5);
    expect((feed.items ?? []).map((item) => item.id)).toEqual([
      "plan-new",
      "run-1",
      "plan-missing-project",
      "run-2",
      "plan-old",
    ]);
    expect(feed.items?.[0]).toMatchObject({
      id: "plan-new",
      kind: "plan",
      plan_id: "plan-new",
      run_id: null,
      project_id: "project-a",
      project_name: "Project Alpha",
      goal: "Newest plan goal",
      stage: null,
      step_count: 1,
      job_count: 0,
      created_at: "2026-01-05T00:00:00Z",
    });
    expect(feed.items?.find((item) => item.id === "run-1")).toMatchObject({
      id: "run-1",
      kind: "run",
      plan_id: "plan-new",
      run_id: "run-1",
      project_id: "project-a",
      project_name: "Project Alpha",
      goal: null,
      stage: "await",
      step_count: 0,
      job_count: 2,
      created_at: "2026-01-04T00:00:00Z",
    });
    expect(feed.generated_at).toBe(NOW);
  });

  it("excludes orphan runs whose plan is missing", () => {
    const feed = deriveOrchestrationFeed(plans, runs, projects, NOW);
    expect(feed.items?.some((item) => item.id === "run-orphan")).toBe(false);
  });

  it("uses a stable 'Unknown project' name for a missing project", () => {
    const feed = deriveOrchestrationFeed(plans, runs, projects, NOW);
    expect(feed.items?.find((item) => item.id === "plan-missing-project")?.project_name).toBe(
      "Unknown project",
    );
  });

  it("breaks creation-time ties deterministically by kind then id", () => {
    const tied = [
      { ...plans[0]!, plan_id: "b", created_at: "2026-01-05T00:00:00Z" },
      { ...plans[0]!, plan_id: "a", created_at: "2026-01-05T00:00:00Z" },
    ];
    const tiedRuns: OrchestrationRun[] = [
      {
        run_id: "c",
        plan_id: "a",
        stage: "plan",
        created_at: "2026-01-05T00:00:00Z",
      },
    ];
    const feed = deriveOrchestrationFeed(tied, tiedRuns, projects, NOW);
    // "run" > "plan" lexicographically, so the run comes first; ids then descend.
    expect((feed.items ?? []).map((item) => item.id)).toEqual(["c", "b", "a"]);
  });

  it("filters by kind and project independently", () => {
    expect(deriveOrchestrationFeed(plans, runs, projects, NOW, { kind: "plan" }).total).toBe(3);
    expect(deriveOrchestrationFeed(plans, runs, projects, NOW, { kind: "run" }).total).toBe(2);
    expect(deriveOrchestrationFeed(plans, runs, projects, NOW, { projectId: "project-a" }).total).toBe(2);
    const both = deriveOrchestrationFeed(plans, runs, projects, NOW, {
      kind: "run",
      projectId: "project-a",
    });
    expect(both.total).toBe(1);
    expect(both.items?.[0]?.id).toBe("run-1");
    expect(deriveOrchestrationFeed(plans, runs, projects, NOW, { kind: "plan", projectId: "project-b" }).total).toBe(1);
    expect(deriveOrchestrationFeed(plans, runs, projects, NOW, { kind: "plan", projectId: "missing-project" }).total).toBe(1);
  });

  it("bounds the page with a whole-scope total counted before paging", () => {
    const feed = deriveOrchestrationFeed(plans, runs, projects, NOW, { limit: 2 });
    expect(feed.total).toBe(5);
    expect(feed.items ?? []).toHaveLength(2);
  });

  it("returns an empty feed for empty stores", () => {
    expect(deriveOrchestrationFeed([], [], projects, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });
});

describe("validateOrchestrationFeedArgs", () => {
  it("accepts empty options and well-formed filters and limits", () => {
    expect(() => validateOrchestrationFeedArgs()).not.toThrow();
    expect(() =>
      validateOrchestrationFeedArgs({
        projectId: "0b5c1e2a-1000-4000-8000-000000000001",
        kind: "run",
        limit: 200,
      }),
    ).not.toThrow();
  });

  it("rejects a malformed project id with a 422", () => {
    expect(() => validateOrchestrationFeedArgs({ projectId: "not-a-uuid" })).toThrowError(ApiError);
    try {
      validateOrchestrationFeedArgs({ projectId: "not-a-uuid" });
    } catch (cause) {
      expect(cause).toMatchObject({ status: 422, code: "validation_error" });
    }
  });

  it("rejects an unknown kind with a 422", () => {
    expect(() => validateOrchestrationFeedArgs({ kind: "mystery" as never })).toThrowError(ApiError);
  });

  it.each([0, 201, -1, 1.5])("rejects an out-of-range limit (%s) with a 422", (limit) => {
    expect(() => validateOrchestrationFeedArgs({ limit })).toThrowError(ApiError);
  });
});

describe("orchestrationFeedQueryParams", () => {
  it("maps options to the wire query string", () => {
    expect(
      orchestrationFeedQueryParams({
        projectId: "project-1",
        kind: "plan",
        limit: 5,
      }),
    ).toEqual({ project_id: "project-1", kind: "plan", limit: 5 });
    expect(orchestrationFeedQueryParams()).toEqual({
      project_id: undefined,
      kind: undefined,
      limit: undefined,
    });
  });
});
