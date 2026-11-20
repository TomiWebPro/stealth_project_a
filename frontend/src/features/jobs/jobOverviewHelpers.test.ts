import { describe, expect, it } from "vitest";
import type { JobEvent, JobOverview } from "../../lib/types";
import {
  hasJobOverviewData,
  jobOverviewAttemptLabel,
  jobOverviewEventCount,
  jobOverviewEventTypeRows,
  jobOverviewGeneratedAtLabel,
  jobOverviewIdentity,
  jobOverviewProgressFraction,
  jobOverviewProgressPercent,
  jobOverviewRecentEvents,
  jobOverviewRelativeLabel,
  jobOverviewResultLabel,
  jobOverviewRetryCount,
  jobOverviewShortId,
  jobOverviewStatRows,
  jobOverviewSummaryLabel,
} from "./jobOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function event(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    type: "status",
    job_id: "job-aaaa-1111",
    seq: 3,
    status: "running",
    progress: 0.45,
    message: "Started frame generation",
    timestamp: "2026-01-01T00:40:00Z",
    ...overrides,
  };
}

function overview(overrides: Partial<JobOverview> = {}): JobOverview {
  return {
    job_id: "job-aaaa-1111",
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    operation_id: "image-to-video",
    schema_version: "1.0",
    status: "running",
    progress: 0.45,
    attempt: 2,
    created_by: "user-aaaa-3333",
    created_at: "2026-01-01T00:00:00Z",
    started_at: "2026-01-01T00:05:00Z",
    finished_at: null,
    result: null,
    error: null,
    counts: {
      events: 4,
      retries: 1,
      by_event_type: [
        { type: "status", count: 2 },
        { type: "progress", count: 2 },
      ],
    },
    recent_events: [event()],
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function emptyOverview(): JobOverview {
  return overview({
    status: "queued",
    progress: 0,
    attempt: 0,
    started_at: null,
    counts: { events: 0, retries: 0, by_event_type: [] },
    recent_events: [],
  });
}

describe("jobOverview formatters", () => {
  it("formats relative labels defensively", () => {
    expect(jobOverviewRelativeLabel(null)).toBe("");
    expect(jobOverviewRelativeLabel(undefined)).toBe("");
    expect(jobOverviewRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(jobOverviewRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("formats the generated-at footer label", () => {
    expect(jobOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
    expect(jobOverviewGeneratedAtLabel(undefined)).toBe("");
  });

  it("zero-fills malformed event/retry counts", () => {
    expect(jobOverviewEventCount(overview())).toBe(4);
    expect(jobOverviewRetryCount(overview())).toBe(1);
    expect(jobOverviewEventCount(overview({ counts: {} as JobOverview["counts"] }))).toBe(0);
    expect(jobOverviewRetryCount(undefined)).toBe(0);
    expect(jobOverviewEventCount(overview({ counts: { events: -2, retries: -1 } }))).toBe(0);
  });

  it("clamps progress into a 0..1 fraction and 0..100 percent", () => {
    expect(jobOverviewProgressFraction(overview())).toBeCloseTo(0.45);
    expect(jobOverviewProgressPercent(overview())).toBe(45);
    expect(jobOverviewProgressFraction(overview({ progress: 2 }))).toBe(1);
    expect(jobOverviewProgressPercent(overview({ progress: -1 }))).toBe(0);
    expect(jobOverviewProgressPercent(undefined)).toBe(0);
  });

  it("derives defensive attempt and short-id labels", () => {
    expect(jobOverviewAttemptLabel(2)).toBe("attempt 2");
    expect(jobOverviewAttemptLabel(0)).toBe("attempt ?");
    expect(jobOverviewAttemptLabel(undefined)).toBe("attempt ?");
    expect(jobOverviewShortId("job-aaaa-1111")).toBe("job-aaaa…");
    expect(jobOverviewShortId("short")).toBe("short");
    expect(jobOverviewShortId(undefined)).toBe("—");
  });

  it("summarizes a terminal result", () => {
    expect(jobOverviewResultLabel(null)).toBe("");
    expect(jobOverviewResultLabel({ text: "Done" })).toBe("Done");
    expect(jobOverviewResultLabel({ asset_ids: ["a", "b"] })).toBe("2 assets");
    expect(jobOverviewResultLabel({ text: "Done", asset_ids: ["a"] })).toBe("Done · 1 asset");
  });
});

describe("jobOverviewIdentity", () => {
  it("derives identity, progress and recency for a populated snapshot", () => {
    expect(jobOverviewIdentity(overview(), NOW)).toEqual({
      jobIdLabel: "job-aaaa…",
      operationLabel: "Image To Video",
      projectLabel: "A Short Film",
      statusLabel: "Running",
      statusTone: "info",
      attemptLabel: "attempt 2",
      schemaLabel: "1.0",
      progressPercent: 45,
      progressFraction: 0.45,
      errorLabel: "",
      resultLabel: "",
      createdLabel: "1 hour ago",
      startedLabel: "55 minutes ago",
      finishedLabel: "",
    });
  });

  it("surfaces terminal error and result signals", () => {
    const failed = overview({
      status: "failed",
      error: { code: "gpu_oom", message: "Out of memory" },
    });
    expect(jobOverviewIdentity(failed).errorLabel).toBe("gpu_oom: Out of memory");
    const succeeded = overview({
      status: "succeeded",
      result: { asset_ids: ["asset-1"] },
      finished_at: "2026-01-01T00:55:00Z",
    });
    const identity = jobOverviewIdentity(succeeded, NOW);
    expect(identity.resultLabel).toBe("1 asset");
    expect(identity.finishedLabel).toBe("5 minutes ago");
  });

  it("is defensive for a missing snapshot", () => {
    expect(jobOverviewIdentity(undefined, NOW)).toEqual({
      jobIdLabel: "—",
      operationLabel: "Unknown operation",
      projectLabel: "",
      statusLabel: "Unknown",
      statusTone: "neutral",
      attemptLabel: "attempt ?",
      schemaLabel: "—",
      progressPercent: 0,
      progressFraction: 0,
      errorLabel: "",
      resultLabel: "",
      createdLabel: "",
      startedLabel: "",
      finishedLabel: "",
    });
  });
});

describe("jobOverviewStatRows", () => {
  it("derives the four headline counters in a stable order", () => {
    const rows = jobOverviewStatRows(overview());
    expect(rows.map((row) => row.key)).toEqual(["events", "retries", "status", "progress"]);
    expect(rows.map((row) => row.value)).toEqual(["4", "1", "Running", "45%"]);
    expect(rows.every((row) => row.label && row.hint)).toBe(true);
  });

  it("zero-fills every counter when the snapshot is absent", () => {
    const rows = jobOverviewStatRows(undefined);
    expect(rows.map((row) => row.value)).toEqual(["0", "0", "Unknown", "0%"]);
  });
});

describe("jobOverviewEventTypeRows", () => {
  it("mirrors the canonical zero-filled event-type distribution", () => {
    const rows = jobOverviewEventTypeRows(overview());
    expect(rows.map((row) => row.type)).toEqual([
      "status",
      "progress",
      "intermediate",
      "result",
      "error",
      "log",
    ]);
    expect(rows.find((row) => row.type === "status")).toMatchObject({ count: 2, percent: 50 });
    expect(rows.find((row) => row.type === "error")).toMatchObject({ count: 0, percent: 0 });
  });

  it("is entirely zero-filled when buckets are absent", () => {
    expect(jobOverviewEventTypeRows(emptyOverview()).every((row) => row.count === 0)).toBe(true);
    expect(jobOverviewEventTypeRows(undefined).every((row) => row.count === 0)).toBe(true);
  });
});

describe("jobOverviewRecentEvents", () => {
  it("projects recent events into render-safe rows", () => {
    const rows = jobOverviewRecentEvents(overview(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "job-aaaa-1111:3",
      seq: 3,
      typeLabel: "Status",
      typeTone: "info",
      statusLabel: "Running",
      statusTone: "info",
      message: "Started frame generation",
      progressPercent: 45,
      timestamp: "2026-01-01T00:40:00Z",
      relativeTime: "20 minutes ago",
    });
  });

  it("falls back to error text and handles a missing status", () => {
    const rows = jobOverviewRecentEvents(
      overview({
        recent_events: [
          event({ status: undefined, message: "  ", error: { code: "x", message: "Boom" } }),
        ],
      }),
      NOW,
    );
    expect(rows[0]!.statusLabel).toBe("—");
    expect(rows[0]!.message).toBe("Boom");
    expect(jobOverviewRecentEvents(undefined)).toEqual([]);
    expect(jobOverviewRecentEvents(overview({ recent_events: undefined }))).toEqual([]);
  });
});

describe("hasJobOverviewData", () => {
  it("is false for a missing or entirely inactive snapshot", () => {
    expect(hasJobOverviewData(undefined)).toBe(false);
    expect(hasJobOverviewData(emptyOverview())).toBe(false);
  });

  it("is true when a count or a recent event is present", () => {
    expect(hasJobOverviewData(overview())).toBe(true);
    expect(hasJobOverviewData(overview({ counts: { events: 0, retries: 2 } }))).toBe(true);
    expect(
      hasJobOverviewData(overview({ counts: { events: 0, retries: 0 }, recent_events: [event()] })),
    ).toBe(true);
  });
});

describe("jobOverviewSummaryLabel", () => {
  it("summarizes the event and retry totals with pluralization", () => {
    expect(jobOverviewSummaryLabel(overview())).toBe("4 events · 1 retry");
    expect(jobOverviewSummaryLabel(emptyOverview())).toBe("0 events · 0 retries");
    expect(jobOverviewSummaryLabel(undefined)).toBe("");
  });
});
