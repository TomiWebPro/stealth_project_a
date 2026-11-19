import { describe, expect, it } from "vitest";
import type { OrchestrationFeed, OrchestrationFeedItem } from "../../lib/types";
import {
  buildOrchestrationFeedOptions,
  orchestrationFeedCountsLabel,
  orchestrationFeedDetailLabel,
  orchestrationFeedEmptyDescription,
  orchestrationFeedGeneratedAtLabel,
  orchestrationFeedKindChipLabel,
  orchestrationFeedKindTone,
  orchestrationFeedProjectName,
  orchestrationFeedRows,
  orchestrationFeedSummary,
  ORCHESTRATION_FEED_KIND_FILTERS,
  ORCHESTRATION_FEED_LIMITS,
  orchestrationStageLabel,
  orchestrationStageTone,
  shortOrchestrationFeedId,
} from "./orchestrationFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<OrchestrationFeedItem> = {}): OrchestrationFeedItem {
  return {
    id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    kind: "plan",
    plan_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    run_id: null,
    project_id: "11111111-1111-4111-8111-111111111111",
    project_name: "Short Film",
    goal: "Resolve the hero shot",
    stage: null,
    step_count: 4,
    job_count: 0,
    created_at: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function feed(items: readonly OrchestrationFeedItem[], total = items.length): OrchestrationFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("buildOrchestrationFeedOptions", () => {
  it("omits both filters when unscoped", () => {
    expect(buildOrchestrationFeedOptions(undefined, undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the project and kind filters when provided", () => {
    expect(buildOrchestrationFeedOptions("11111111-1111-4111-8111-111111111111", "run", 10)).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
      kind: "run",
      limit: 10,
    });
  });

  it("offers the canonical page sizes and kind chips", () => {
    expect(ORCHESTRATION_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(ORCHESTRATION_FEED_KIND_FILTERS).toEqual([undefined, "plan", "run"]);
  });
});

describe("orchestration feed chip labels and tones", () => {
  it("labels the unfiltered chip and canonical kinds", () => {
    expect(orchestrationFeedKindChipLabel(undefined)).toBe("All");
    expect(orchestrationFeedKindChipLabel("plan")).toBe("Plans");
    expect(orchestrationFeedKindChipLabel("run")).toBe("Runs");
  });

  it("maps canonical kinds and stages to badge tones/labels", () => {
    expect(orchestrationFeedKindTone("plan")).toBe("info");
    expect(orchestrationFeedKindTone("run")).toBe("accent");
    expect(orchestrationStageLabel("await")).toBe("Await");
    expect(orchestrationStageLabel("done")).toBe("Done");
    expect(orchestrationStageTone("done")).toBe("success");
    expect(orchestrationStageTone("await")).toBe("warning");
  });
});

describe("orchestrationFeedCountsLabel / fallbacks", () => {
  it("pluralizes step/job counts and defaults malformed values to zero", () => {
    expect(orchestrationFeedCountsLabel(1, 1)).toBe("1 step · 1 job");
    expect(orchestrationFeedCountsLabel(4, 2)).toBe("4 steps · 2 jobs");
    expect(orchestrationFeedCountsLabel(undefined, -3)).toBe("0 steps · 0 jobs");
    expect(orchestrationFeedCountsLabel(Number.NaN, 3)).toBe("0 steps · 3 jobs");
  });

  it("shortens ids and falls back for missing project names", () => {
    expect(shortOrchestrationFeedId("abcdefgh-1111-4111-8111-abcdefghijkl")).toBe("abcdefgh…");
    expect(shortOrchestrationFeedId("short")).toBe("short");
    expect(shortOrchestrationFeedId(undefined)).toBe("—");
    expect(orchestrationFeedProjectName("Short Film")).toBe("Short Film");
    expect(orchestrationFeedProjectName("  ")).toBe("Unknown project");
    expect(orchestrationFeedProjectName(undefined)).toBe("Unknown project");
  });
});

describe("orchestrationFeedDetailLabel", () => {
  it("prefers a plan goal and falls back to a stable label", () => {
    expect(orchestrationFeedDetailLabel(item())).toBe("Resolve the hero shot");
    expect(orchestrationFeedDetailLabel(item({ goal: "  " }))).toBe("Plan");
    expect(orchestrationFeedDetailLabel(item({ goal: null }))).toBe("Plan");
  });

  it("uses the lifecycle stage for runs", () => {
    expect(
      orchestrationFeedDetailLabel(item({ kind: "run", goal: null, stage: "collect" })),
    ).toBe("Collect");
    expect(orchestrationFeedDetailLabel(item({ kind: "run", goal: null, stage: null }))).toBe("Run");
  });
});

describe("orchestrationFeedRows", () => {
  it("returns an empty list for an unset, failed or item-less feed", () => {
    expect(orchestrationFeedRows(undefined, NOW)).toEqual([]);
    expect(orchestrationFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" }, NOW)).toEqual([]);
    expect(orchestrationFeedRows(feed([]), NOW)).toEqual([]);
  });

  it("derives render-ready rows while preserving newest-first wire order", () => {
    const rows = orchestrationFeedRows(
      feed([
        item(),
        item({
          id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
          plan_id: "cccccccc-3333-4333-8333-cccccccccccc",
          kind: "run",
          goal: null,
          stage: "submit",
          project_name: "",
          step_count: 0,
          job_count: 3,
          created_at: "2026-01-01T00:20:00Z",
        }),
      ]),
      NOW,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([
      "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
    ]);
    expect(rows[0]).toMatchObject({
      shortId: "aaaaaaaa…",
      projectId: "11111111-1111-4111-8111-111111111111",
      projectName: "Short Film",
      kind: "plan",
      kindLabel: "Plan",
      kindTone: "info",
      detailLabel: "Resolve the hero shot",
      stageLabel: "",
      stageTone: undefined,
      countsLabel: "4 steps · 0 jobs",
      timestamp: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      projectName: "Unknown project",
      kind: "run",
      kindLabel: "Run",
      kindTone: "accent",
      detailLabel: "Submit",
      stageLabel: "Submit",
      stageTone: "info",
      countsLabel: "0 steps · 3 jobs",
      relativeTime: "40 minutes ago",
    });
  });
});

describe("orchestrationFeedSummary", () => {
  it("describes an empty feed", () => {
    expect(orchestrationFeedSummary([], 0)).toBe("No orchestration activity");
  });

  it("uses the untruncated total and the newest item", () => {
    const rows = orchestrationFeedRows(feed([item()]), NOW);
    expect(orchestrationFeedSummary(rows, 99)).toBe("99 items · latest: Plan in Short Film");
    expect(orchestrationFeedSummary(rows)).toBe("1 item · latest: Plan in Short Film");
  });
});

describe("orchestrationFeedGeneratedAtLabel", () => {
  it("is empty when absent and relative when present", () => {
    expect(orchestrationFeedGeneratedAtLabel(undefined, NOW)).toBe("");
    expect(orchestrationFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
  });
});

describe("orchestrationFeedEmptyDescription", () => {
  it("is scope-aware", () => {
    expect(orchestrationFeedEmptyDescription(true)).toContain("filters");
    expect(orchestrationFeedEmptyDescription(false)).toContain("Plans and execution runs");
  });
});
