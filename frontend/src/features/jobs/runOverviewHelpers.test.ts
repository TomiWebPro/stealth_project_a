import { describe, expect, it } from "vitest";
import type {
  JobStatus,
  OrchestrationFeed,
  OrchestrationFeedItem,
  OrchestrationStage,
  RunOverview,
} from "../../lib/types";
import {
  buildRunPickerFeedOptions,
  hasRunOverviewData,
  runOptionLabel,
  runOverviewCounts,
  runOverviewGeneratedAtLabel,
  runOverviewIdentity,
  runOverviewJobRows,
  runOverviewOptions,
  runOverviewRelativeLabel,
  runOverviewStatRows,
  runOverviewStatusRows,
  runOverviewSummaryLabel,
  RUN_OVERVIEW_PICKER_LIMIT,
  RUN_OVERVIEW_RECENT_LIMITS,
  runPickerOptions,
} from "./runOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function overview(overrides: Partial<RunOverview> = {}): RunOverview {
  return {
    run_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    plan_id: "22222222-2222-4222-8222-222222222222",
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "Short Film",
    plan_goal: "Resolve the opening shot",
    stage: "submit",
    created_at: "2026-01-01T00:45:00Z",
    counts: { jobs_linked: 5, jobs_resolved: 4, plan_steps: 3 },
    by_status: [
      { status: "running", count: 2 },
      { status: "succeeded", count: 2 },
    ],
    recent_jobs: [
      {
        job_id: "bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb",
        operation_id: "image-to-video",
        status: "running",
        progress: 0.42,
        created_at: "2026-01-01T00:40:00Z",
      },
      {
        job_id: "cccccccc-4444-4444-8444-cccccccccccc",
        operation_id: "lora_train",
        status: "succeeded",
        progress: 1,
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
    kind: "run",
    plan_id: "22222222-2222-4222-8222-222222222222",
    run_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "Short Film",
    goal: null,
    stage: "submit",
    step_count: 0,
    job_count: 4,
    created_at: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function feed(items: readonly OrchestrationFeedItem[]): OrchestrationFeed {
  return { items: [...items], total: items.length, generated_at: "2026-01-01T00:59:00Z" };
}

describe("run overview query option helpers", () => {
  it("omits the recent limit when unset and includes it when provided", () => {
    expect(runOverviewOptions()).toEqual({});
    expect(runOverviewOptions(10)).toEqual({ recentLimit: 10 });
  });

  it("builds a run-only, project-scoped picker feed with a bounded page size", () => {
    expect(buildRunPickerFeedOptions()).toEqual({ kind: "run", limit: RUN_OVERVIEW_PICKER_LIMIT });
    expect(buildRunPickerFeedOptions("11111111-1111-4111-8111-111111111111")).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
      kind: "run",
      limit: RUN_OVERVIEW_PICKER_LIMIT,
    });
    expect(RUN_OVERVIEW_RECENT_LIMITS).toEqual([5, 10, 25]);
  });
});

describe("run picker options", () => {
  it("labels a run with its short id, joined project name and stage", () => {
    expect(runOptionLabel(feedItem())).toBe(
      "Run · aaaaaaaa… · Short Film · Submit",
    );
    expect(
      runOptionLabel(feedItem({ project_name: "", stage: null })),
    ).toBe("Run · aaaaaaaa… · Unknown project · Run");
  });

  it("maps only run records into stable options and tolerates missing feeds", () => {
    expect(runPickerOptions()).toEqual([]);
    expect(runPickerOptions(feed([]))).toEqual([]);
    const plan = feedItem({ id: "pppppppp-9999-4999-8999-pppppppppppp", kind: "plan", run_id: null });
    expect(
      runPickerOptions(
        feed([
          feedItem(),
          plan,
          feedItem({
            id: "eeeeeeee-5555-4555-8555-eeeeeeeeeeee",
            run_id: "eeeeeeee-5555-4555-8555-eeeeeeeeeeee",
            stage: "done" as OrchestrationStage,
          }),
        ]),
      ),
    ).toEqual([
      {
        value: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        label: "Run · aaaaaaaa… · Short Film · Submit",
      },
      {
        value: "eeeeeeee-5555-4555-8555-eeeeeeeeeeee",
        label: "Run · eeeeeeee… · Short Film · Done",
      },
    ]);
  });

  it("falls back to the item id when a run lacks a run_id", () => {
    const rows = runPickerOptions(feed([feedItem({ run_id: null })]));
    expect(rows[0]?.value).toBe("aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa");
  });
});

describe("runOverviewRelativeLabel / generated at", () => {
  it("is empty when absent and relative when present", () => {
    expect(runOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(runOverviewRelativeLabel("", NOW)).toBe("");
    expect(runOverviewRelativeLabel("2026-01-01T00:45:00Z", NOW)).toBe("15 minutes ago");
    expect(runOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
    expect(runOverviewGeneratedAtLabel(overview(), NOW)).toBe("1 minute ago");
  });
});

describe("runOverviewCounts", () => {
  it("zero-fills and truncates malformed counts", () => {
    expect(runOverviewCounts()).toEqual({ jobsLinked: 0, jobsResolved: 0, planSteps: 0 });
    expect(runOverviewCounts(overview())).toEqual({ jobsLinked: 5, jobsResolved: 4, planSteps: 3 });
    expect(
      runOverviewCounts(
        overview({
          counts: { jobs_linked: -1, jobs_resolved: 2.9, plan_steps: Number.NaN },
        }),
      ),
    ).toEqual({ jobsLinked: 0, jobsResolved: 2, planSteps: 0 });
  });
});

describe("runOverviewIdentity", () => {
  it("derives run/plan/project/stage labels and recency", () => {
    expect(runOverviewIdentity(overview(), NOW)).toEqual({
      runIdLabel: "aaaaaaaa…",
      planIdLabel: "22222222…",
      projectName: "Short Film",
      projectId: "11111111-1111-4111-8111-111111111111",
      planGoalLabel: "Resolve the opening shot",
      stageLabel: "Submit",
      stageTone: "info",
      createdLabel: "15 minutes ago",
    });
  });

  it("falls back for a missing snapshot or blank goal/project/stage", () => {
    expect(runOverviewIdentity(undefined, NOW)).toEqual({
      runIdLabel: "—",
      planIdLabel: "—",
      projectName: "Unknown project",
      projectId: "",
      planGoalLabel: "No plan goal recorded",
      stageLabel: "—",
      stageTone: "neutral",
      createdLabel: "",
    });
    expect(
      runOverviewIdentity(overview({ plan_goal: "  ", project_name: "", stage: "" as OrchestrationStage }), NOW),
    ).toMatchObject({
      projectName: "Unknown project",
      planGoalLabel: "No plan goal recorded",
      stageLabel: "—",
      stageTone: "neutral",
    });
  });
});

describe("runOverviewStatRows", () => {
  it("renders whole-run totals alongside the bounded recent count", () => {
    const rows = runOverviewStatRows(overview());
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => [row.key, row.value])).toEqual([
      ["plan-steps", "3"],
      ["jobs-linked", "5"],
      ["jobs-resolved", "4"],
      ["recent-jobs", "2"],
    ]);
    expect(runOverviewStatRows().every((row) => row.value === "0")).toBe(true);
  });
});

describe("runOverviewStatusRows", () => {
  it("returns the five canonical statuses zero-filled with shares from by_status", () => {
    const rows = runOverviewStatusRows(overview());
    expect(rows.map((row) => row.status)).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
      "canceled",
    ]);
    expect(rows.map((row) => [row.label, row.count])).toEqual([
      ["Queued", 0],
      ["Running", 2],
      ["Succeeded", 2],
      ["Failed", 0],
      ["Canceled", 0],
    ]);
    expect(rows[1]).toMatchObject({ tone: "info", percent: 50, fraction: 0.5 });
    expect(rows[2]).toMatchObject({ tone: "success", percent: 50 });
    expect(rows[0]).toMatchObject({ label: "Queued", count: 0, fraction: 0 });
  });

  it("is fully zero-filled for a missing snapshot or empty breakdown", () => {
    for (const rows of [
      runOverviewStatusRows(),
      runOverviewStatusRows(overview({ by_status: [] })),
    ]) {
      expect(rows).toHaveLength(5);
      expect(rows.every((row) => row.count === 0 && row.percent === 0 && row.fraction === 0)).toBe(
        true,
      );
    }
  });
});

describe("runOverviewJobRows", () => {
  it("projects recent jobs with status badges, humanized operations and progress", () => {
    const rows = runOverviewJobRows(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([
      "bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb",
      "cccccccc-4444-4444-8444-cccccccccccc",
    ]);
    expect(rows[0]).toMatchObject({
      shortId: "bbbbbbbb…",
      operationLabel: "Image To Video",
      statusLabel: "Running",
      statusTone: "info",
      progressFraction: 0.42,
      progressPercent: 42,
      timestamp: "2026-01-01T00:40:00Z",
      relativeTime: "20 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      operationLabel: "Lora Train",
      statusLabel: "Succeeded",
      statusTone: "success",
      progressFraction: 1,
      progressPercent: 100,
    });
  });

  it("clamps out-of-range progress and falls back for a missing status", () => {
    const rows = runOverviewJobRows(
      overview({
        recent_jobs: [
          {
            job_id: "ffffffff-6666-4666-8666-ffffffffffff",
            operation_id: "dataset-prep",
            status: "" as JobStatus,
            progress: 3.4,
            created_at: "2026-01-01T00:00:00Z",
          },
          {
            job_id: "dddddddd-7777-4777-8777-dddddddddddd",
            operation_id: "splat-train",
            status: "failed",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
      NOW,
    );
    expect(rows[0]).toMatchObject({
      operationLabel: "Dataset Prep",
      statusLabel: "—",
      statusTone: "neutral",
      progressFraction: 1,
      progressPercent: 100,
    });
    // Absent progress is zero-filled and a valid status keeps its canonical badge.
    expect(rows[1]).toMatchObject({
      statusLabel: "Failed",
      statusTone: "danger",
      progressFraction: 0,
      progressPercent: 0,
    });
    expect(runOverviewJobRows()).toEqual([]);
    expect(runOverviewJobRows(overview({ recent_jobs: [] }))).toEqual([]);
  });
});

describe("runOverviewSummaryLabel / hasRunOverviewData", () => {
  it("summarizes project, stage and resolution counts", () => {
    expect(runOverviewSummaryLabel()).toBe("");
    expect(runOverviewSummaryLabel(overview())).toBe(
      "Run in Short Film · Submit · 4/5 jobs resolved",
    );
  });

  it("detects missing, empty and populated snapshots", () => {
    expect(hasRunOverviewData()).toBe(false);
    expect(
      hasRunOverviewData(
        overview({
          counts: { jobs_linked: 0, jobs_resolved: 0, plan_steps: 0 },
          by_status: [],
          recent_jobs: [],
        }),
      ),
    ).toBe(false);
    expect(
      hasRunOverviewData(
        overview({
          counts: { jobs_linked: 0, jobs_resolved: 0, plan_steps: 0 },
          by_status: [],
        }),
      ),
    ).toBe(true);
    expect(hasRunOverviewData(overview())).toBe(true);
  });
});
