import { describe, expect, it } from "vitest";
import type { OrchestrationStats } from "../../lib/types";
import {
  hasOrchestrationStatsData,
  newestOrchestrationSignalLabel,
  orchestrationProjectRows,
  orchestrationRelativeLabel,
  orchestrationStageRows,
  orchestrationStatsCards,
  orchestrationStatsGeneratedAtLabel,
  shortOrchestrationProjectId,
} from "./orchestrationStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";

const populated: OrchestrationStats = {
  total_plans: 5,
  total_runs: 12,
  total_steps: 23,
  total_jobs_linked: 9,
  by_stage: [
    { stage: "plan", count: 2 },
    { stage: "resolve", count: 3 },
    { stage: "submit", count: 4 },
    { stage: "await", count: 1 },
    { stage: "collect", count: 1 },
    { stage: "done", count: 1 },
  ],
  by_project: [
    { project_id: PROJECT_A, plans: 3, runs: 8 },
    { project_id: PROJECT_B, plans: 2, runs: 4 },
  ],
  newest_plan_at: "2026-01-01T00:30:00Z",
  newest_run_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: OrchestrationStats = {
  total_plans: 0,
  total_runs: 0,
  total_steps: 0,
  total_jobs_linked: 0,
  by_stage: [
    { stage: "plan", count: 0 },
    { stage: "resolve", count: 0 },
    { stage: "submit", count: 0 },
    { stage: "await", count: 0 },
    { stage: "collect", count: 0 },
    { stage: "done", count: 0 },
  ],
  by_project: [],
  newest_plan_at: null,
  newest_run_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("orchestration stats formatters", () => {
  it("shortens long project ids and keeps short ones intact", () => {
    expect(shortOrchestrationProjectId(PROJECT_A)).toBe("11111111…");
    expect(shortOrchestrationProjectId("short")).toBe("short");
  });

  it("formats relative labels and treats invalid timestamps as raw values", () => {
    expect(orchestrationRelativeLabel(null)).toBe("");
    expect(orchestrationRelativeLabel(undefined)).toBe("");
    expect(orchestrationRelativeLabel("2026-01-01T00:45:00Z", NOW)).toBe("15 minutes ago");
    expect(orchestrationRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("picks the newer of the two recency signals", () => {
    expect(newestOrchestrationSignalLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestOrchestrationSignalLabel({ ...populated, newest_run_at: null }, NOW)).toBe(
      "30 minutes ago",
    );
    expect(newestOrchestrationSignalLabel({ ...populated, newest_plan_at: null }, NOW)).toBe(
      "15 minutes ago",
    );
    expect(newestOrchestrationSignalLabel(empty, NOW)).toBe("");
    expect(newestOrchestrationSignalLabel(undefined, NOW)).toBe("");
  });

  it("formats the generated-at footer", () => {
    expect(orchestrationStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(orchestrationStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("orchestrationStatsCards", () => {
  it("derives the four counters in a stable order", () => {
    const cards = orchestrationStatsCards(populated);
    expect(cards.map((card) => card.key)).toEqual(["plans", "runs", "steps", "jobs"]);
    expect(cards.map((card) => card.value)).toEqual(["5", "12", "23", "9"]);
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(orchestrationStatsCards(undefined).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0",
      "0",
    ]);
    expect(orchestrationStatsCards(empty).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0",
      "0",
    ]);
  });
});

describe("orchestrationStageRows", () => {
  it("returns all six canonical stages in lifecycle order with shares", () => {
    const rows = orchestrationStageRows(populated);
    expect(rows.map((row) => row.stage)).toEqual([
      "plan",
      "resolve",
      "submit",
      "await",
      "collect",
      "done",
    ]);
    const byStage = new Map(rows.map((row) => [row.stage, row]));
    expect(byStage.get("submit")?.count).toBe(4);
    expect(byStage.get("submit")?.percent).toBe(33);
    expect(byStage.get("submit")?.fraction).toBeCloseTo(4 / 12);
    expect(byStage.get("done")?.tone).toBe("success");
    expect(byStage.get("await")?.tone).toBe("warning");
  });

  it("zero-fills every stage when the snapshot is absent, empty or partial", () => {
    for (const stats of [undefined, empty, { ...empty, total_plans: 1 }]) {
      const rows = orchestrationStageRows(stats);
      expect(rows).toHaveLength(6);
      expect(rows.every((row) => row.count === 0 && row.percent === 0 && row.fraction === 0)).toBe(
        true,
      );
    }
  });
});

describe("orchestrationProjectRows", () => {
  it("sorts by descending plans then runs then id and resolves friendly names", () => {
    const rows = orchestrationProjectRows(populated, { [PROJECT_B]: "Second film" });
    expect(rows.map((row) => row.projectId)).toEqual([PROJECT_A, PROJECT_B]);
    expect(rows[0]).toMatchObject({ label: shortOrchestrationProjectId(PROJECT_A), activity: 11 });
    expect(rows[1]).toMatchObject({ label: "Second film", plans: 2, runs: 4, activity: 6 });
  });

  it("breaks plan-count ties by run count", () => {
    const tied = orchestrationProjectRows({
      ...populated,
      by_project: [
        { project_id: PROJECT_A, plans: 2, runs: 1 },
        { project_id: PROJECT_B, plans: 2, runs: 5 },
      ],
    });
    expect(tied.map((row) => row.projectId)).toEqual([PROJECT_B, PROJECT_A]);
  });

  it("returns no rows for an absent or empty snapshot", () => {
    expect(orchestrationProjectRows(undefined)).toEqual([]);
    expect(orchestrationProjectRows(empty)).toEqual([]);
  });
});

describe("hasOrchestrationStatsData", () => {
  it("detects any activity", () => {
    expect(hasOrchestrationStatsData(populated)).toBe(true);
    expect(hasOrchestrationStatsData(empty)).toBe(false);
    expect(hasOrchestrationStatsData(undefined)).toBe(false);
    expect(hasOrchestrationStatsData({ ...empty, total_jobs_linked: 1 })).toBe(true);
  });
});
