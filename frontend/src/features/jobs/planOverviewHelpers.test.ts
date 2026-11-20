import { describe, expect, it } from "vitest";
import type {
  OrchestrationFeed,
  OrchestrationFeedItem,
  OrchestrationStage,
  PlanOverview,
} from "../../lib/types";
import {
  buildPlanPickerFeedOptions,
  hasPlanOverviewData,
  planOptionLabel,
  planOverviewCounts,
  planOverviewGeneratedAtLabel,
  planOverviewIdentity,
  planOverviewOptions,
  planOverviewRelativeLabel,
  planOverviewStatRows,
  planOverviewSummaryLabel,
  PLAN_OVERVIEW_PICKER_LIMIT,
  PLAN_OVERVIEW_RECENT_LIMITS,
  planOverviewStageRows,
  planPickerOptions,
  planRunRows,
} from "./planOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function overview(overrides: Partial<PlanOverview> = {}): PlanOverview {
  return {
    plan_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "Short Film",
    goal: "Resolve the opening shot",
    created_at: "2026-01-01T00:45:00Z",
    counts: { steps: 4, runs: 3, jobs_linked: 5 },
    by_stage: [
      { stage: "plan", count: 1 },
      { stage: "submit", count: 2 },
    ],
    recent_runs: [
      {
        run_id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
        stage: "submit",
        job_count: 2,
        created_at: "2026-01-01T00:40:00Z",
      },
      {
        run_id: "cccccccc-3333-4333-8333-cccccccccccc",
        stage: "done",
        job_count: 3,
        created_at: "2026-01-01T00:30:00Z",
      },
    ],
    generated_at: "2026-01-01T00:59:00Z",
    ...overrides,
  };
}

function feedItem(overrides: Partial<OrchestrationFeedItem> = {}): OrchestrationFeedItem {
  return {
    id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    kind: "plan",
    plan_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "Short Film",
    goal: "Resolve the opening shot",
    step_count: 4,
    job_count: 5,
    created_at: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function feed(items: readonly OrchestrationFeedItem[]): OrchestrationFeed {
  return { items: [...items], total: items.length, generated_at: "2026-01-01T00:59:00Z" };
}

describe("plan overview query option helpers", () => {
  it("omits the recent limit when unset and includes it when provided", () => {
    expect(planOverviewOptions()).toEqual({});
    expect(planOverviewOptions(10)).toEqual({ recentLimit: 10 });
  });

  it("builds a plan-only, project-scoped picker feed with a bounded page size", () => {
    expect(buildPlanPickerFeedOptions()).toEqual({ kind: "plan", limit: PLAN_OVERVIEW_PICKER_LIMIT });
    expect(buildPlanPickerFeedOptions("11111111-1111-4111-8111-111111111111")).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
      kind: "plan",
      limit: PLAN_OVERVIEW_PICKER_LIMIT,
    });
    expect(PLAN_OVERVIEW_RECENT_LIMITS).toEqual([5, 10, 25]);
  });
});

describe("plan picker options", () => {
  it("labels a plan with its short id, joined project name and goal", () => {
    expect(planOptionLabel(feedItem())).toBe(
      "Plan · aaaaaaaa… · Short Film · Resolve the opening shot",
    );
    expect(
      planOptionLabel(feedItem({ project_name: "", goal: null })),
    ).toBe("Plan · aaaaaaaa… · Unknown project");
  });

  it("maps only plan records into stable options and tolerates missing feeds", () => {
    expect(planPickerOptions()).toEqual([]);
    expect(planPickerOptions(feed([]))).toEqual([]);
    const run = feedItem({ id: "rrrrrrrr-9999-4999-8999-rrrrrrrrrrrr", kind: "run", goal: null });
    expect(
      planPickerOptions(
        feed([
          feedItem(),
          run,
          feedItem({
            id: "eeeeeeee-5555-4555-8555-eeeeeeeeeeee",
            plan_id: "eeeeeeee-5555-4555-8555-eeeeeeeeeeee",
            goal: null,
          }),
        ]),
      ),
    ).toEqual([
      {
        value: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        label: "Plan · aaaaaaaa… · Short Film · Resolve the opening shot",
      },
      {
        value: "eeeeeeee-5555-4555-8555-eeeeeeeeeeee",
        label: "Plan · eeeeeeee… · Short Film",
      },
    ]);
  });
});

describe("planOverviewRelativeLabel / generated at", () => {
  it("is empty when absent and relative when present", () => {
    expect(planOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(planOverviewRelativeLabel("", NOW)).toBe("");
    expect(planOverviewRelativeLabel("2026-01-01T00:45:00Z", NOW)).toBe("15 minutes ago");
    expect(planOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
    expect(planOverviewGeneratedAtLabel(overview(), NOW)).toBe("1 minute ago");
  });
});

describe("planOverviewCounts", () => {
  it("zero-fills and truncates malformed counts", () => {
    expect(planOverviewCounts()).toEqual({ steps: 0, runs: 0, jobsLinked: 0 });
    expect(planOverviewCounts(overview())).toEqual({ steps: 4, runs: 3, jobsLinked: 5 });
    expect(
      planOverviewCounts(
        overview({ counts: { steps: -1, runs: 2.9, jobs_linked: Number.NaN } }),
      ),
    ).toEqual({ steps: 0, runs: 2, jobsLinked: 0 });
  });
});

describe("planOverviewIdentity", () => {
  it("derives plan/project/goal labels and recency", () => {
    expect(planOverviewIdentity(overview(), NOW)).toEqual({
      planIdLabel: "aaaaaaaa…",
      projectName: "Short Film",
      projectId: "11111111-1111-4111-8111-111111111111",
      goalLabel: "Resolve the opening shot",
      createdLabel: "15 minutes ago",
    });
  });

  it("falls back for a missing snapshot or blank goal/project", () => {
    expect(planOverviewIdentity(undefined, NOW)).toEqual({
      planIdLabel: "—",
      projectName: "Unknown project",
      projectId: "",
      goalLabel: "No goal recorded",
      createdLabel: "",
    });
    expect(planOverviewIdentity(overview({ goal: "  ", project_name: "" }), NOW)).toMatchObject({
      projectName: "Unknown project",
      goalLabel: "No goal recorded",
    });
  });
});

describe("planOverviewStatRows", () => {
  it("renders whole-plan totals alongside the bounded recent count", () => {
    const rows = planOverviewStatRows(overview());
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => [row.key, row.value])).toEqual([
      ["steps", "4"],
      ["runs", "3"],
      ["jobs-linked", "5"],
      ["recent-runs", "2"],
    ]);
    expect(planOverviewStatRows().every((row) => row.value === "0")).toBe(true);
  });
});

describe("planOverviewStageRows", () => {
  it("returns the six canonical stages zero-filled with shares from by_stage", () => {
    const rows = planOverviewStageRows(overview());
    expect(rows.map((row) => row.stage)).toEqual([
      "plan",
      "resolve",
      "submit",
      "await",
      "collect",
      "done",
    ]);
    expect(rows.map((row) => [row.label, row.count])).toEqual([
      ["Plan", 1],
      ["Resolve", 0],
      ["Submit", 2],
      ["Await", 0],
      ["Collect", 0],
      ["Done", 0],
    ]);
    expect(rows[0]).toMatchObject({ tone: "info", percent: 33, fraction: 1 / 3 });
    expect(rows[2]).toMatchObject({ tone: "info", percent: 67 });
    expect(rows[3]).toMatchObject({ label: "Await", tone: "warning", count: 0 });
  });

  it("is fully zero-filled for a missing snapshot or empty breakdown", () => {
    for (const rows of [planOverviewStageRows(), planOverviewStageRows(overview({ by_stage: [] }))]) {
      expect(rows).toHaveLength(6);
      expect(rows.every((row) => row.count === 0 && row.percent === 0 && row.fraction === 0)).toBe(true);
    }
  });
});

describe("planRunRows", () => {
  it("projects recent runs with canonical stage badges and job labels", () => {
    const rows = planRunRows(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([
      "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
      "cccccccc-3333-4333-8333-cccccccccccc",
    ]);
    expect(rows[0]).toMatchObject({
      shortId: "bbbbbbbb…",
      stageLabel: "Submit",
      stageTone: "info",
      jobCount: 2,
      jobCountLabel: "2 jobs",
      timestamp: "2026-01-01T00:40:00Z",
      relativeTime: "20 minutes ago",
    });
    expect(rows[1]).toMatchObject({ stageLabel: "Done", stageTone: "success", jobCountLabel: "3 jobs" });
  });

  it("falls back for a run with no stage and is empty for a missing snapshot", () => {
    const rows = planRunRows(
      overview({
        recent_runs: [
          {
            run_id: "ffffffff-6666-4666-8666-ffffffffffff",
            stage: "" as OrchestrationStage, // malformed/empty stage exercises the defensive fallback
            job_count: 0,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
      NOW,
    );
    expect(rows[0]).toMatchObject({
      stageLabel: "—",
      stageTone: "neutral",
      jobCountLabel: "0 jobs",
    });
    expect(planRunRows()).toEqual([]);
    expect(planRunRows(overview({ recent_runs: [] }))).toEqual([]);
  });
});

describe("planOverviewSummaryLabel / hasPlanOverviewData", () => {
  it("summarizes project and whole-plan counts", () => {
    expect(planOverviewSummaryLabel()).toBe("");
    expect(planOverviewSummaryLabel(overview())).toBe(
      "Plan in Short Film · 4 steps · 3 runs · 5 jobs linked",
    );
  });

  it("detects missing, empty and populated snapshots", () => {
    expect(hasPlanOverviewData()).toBe(false);
    expect(
      hasPlanOverviewData(
        overview({ counts: { steps: 0, runs: 0, jobs_linked: 0 }, by_stage: [], recent_runs: [] }),
      ),
    ).toBe(false);
    expect(
      hasPlanOverviewData(overview({ counts: { steps: 0, runs: 0, jobs_linked: 0 }, by_stage: [] })),
    ).toBe(true);
    expect(hasPlanOverviewData(overview())).toBe(true);
  });
});
