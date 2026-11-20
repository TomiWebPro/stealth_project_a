import { describe, expect, it } from "vitest";
import type { EventFeed, EventOverview, JobEvent } from "../../lib/types";
import {
  EVENT_OVERVIEW_LIMITS,
  EVENT_OVERVIEW_RECENT_LIMIT,
  buildEventOverviewOptions,
  eventOverviewActiveOption,
  eventOverviewCount,
  eventOverviewEmptyDescription,
  eventOverviewGeneratedAtLabel,
  eventOverviewIdentity,
  eventOverviewMessagePreview,
  eventOverviewPickerOptions,
  eventOverviewProgressPercent,
  eventOverviewRecentSiblings,
  eventOverviewRelativeLabel,
  eventOverviewSeqLabel,
  eventOverviewStatRows,
  eventOverviewStatusLabel,
  eventOverviewStatusTone,
  eventOverviewSummaryLabel,
  eventOverviewTypeRows,
  eventOverviewTypeTone,
  hasEventOverviewData,
} from "./eventOverviewHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function event(overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    type: "status",
    job_id: "job-aaaa-1111",
    seq: 3,
    status: "running",
    progress: 0.45,
    message: "Started frame generation",
    timestamp: "2026-01-01T00:59:00Z",
    ...overrides,
  };
}

function overview(overrides: Partial<EventOverview> = {}): EventOverview {
  return {
    job_id: "job-aaaa-1111",
    seq: 3,
    type: "status",
    operation_id: "image-to-video",
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    status: "running",
    progress: 0.45,
    message: "  Started   frame   generation  ",
    asset_id: null,
    error: null,
    timestamp: "2026-01-01T00:59:00Z",
    counts: {
      total: 4,
      by_type: [
        { type: "status", count: 2 },
        { type: "progress", count: 2 },
      ],
    },
    recent_siblings: [event()],
    generated_at: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

function feed(): EventFeed {
  return {
    items: [
      {
        job_id: "job-aaaa-1111",
        seq: 3,
        type: "status",
        operation_id: "image-to-video",
        project_id: "proj-aaaa-2222",
        project_name: "A Short Film",
        status: "running",
        progress: 0.45,
        message: "Started frame generation",
        error: null,
        timestamp: "2026-01-01T00:59:00Z",
      },
    ],
    total: 1,
    generated_at: "2026-01-01T00:59:30Z",
  };
}

describe("buildEventOverviewOptions", () => {
  it("defaults to the canonical recent bound", () => {
    expect(buildEventOverviewOptions()).toEqual({ recentLimit: EVENT_OVERVIEW_RECENT_LIMIT });
  });

  it("passes through an explicit page bound", () => {
    expect(buildEventOverviewOptions(10)).toEqual({ recentLimit: 10 });
  });

  it("exposes the three offered page-size chips", () => {
    expect(EVENT_OVERVIEW_LIMITS).toEqual([5, 10, 25]);
  });
});

describe("eventOverviewCount", () => {
  it("reads the whole-job total", () => {
    expect(eventOverviewCount(overview())).toBe(4);
  });

  it("zero-fills absent, negative and non-finite totals", () => {
    expect(eventOverviewCount()).toBe(0);
    expect(eventOverviewCount(overview({ counts: { total: -3 } }))).toBe(0);
    expect(eventOverviewCount(overview({ counts: { total: Number.NaN } }))).toBe(0);
    expect(eventOverviewCount(overview({ counts: {} as EventOverview["counts"] }))).toBe(0);
  });
});

describe("relative labels", () => {
  it("formats event and generated-at timestamps relative to the given clock", () => {
    expect(eventOverviewRelativeLabel("2026-01-01T00:59:00Z", NOW)).toBe("1 minute ago");
    expect(eventOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
  });

  it("returns an empty label for absent timestamps", () => {
    expect(eventOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(eventOverviewRelativeLabel(null, NOW)).toBe("");
    expect(eventOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});

describe("eventOverviewMessagePreview", () => {
  it("normalizes whitespace in a message", () => {
    expect(eventOverviewMessagePreview(event({ message: "  hi   there\nworld " }))).toBe(
      "hi there world",
    );
  });

  it("falls back to the error message when no message is present", () => {
    expect(
      eventOverviewMessagePreview(
        event({ message: null, error: { code: "E", message: "Failed  to render" } }),
      ),
    ).toBe("Failed to render");
  });

  it("uses an explicit fallback and truncates long previews", () => {
    expect(eventOverviewMessagePreview(event({ message: null, error: null }))).toBe("No message");
    const long = "x".repeat(200);
    const preview = eventOverviewMessagePreview(event({ message: long }), 20);
    expect(preview).toBe(`${"x".repeat(20)}…`);
    expect(preview.length).toBe(21);
  });
});

describe("status, type, sequence and progress helpers", () => {
  it("returns human labels and tones for statuses", () => {
    expect(eventOverviewStatusLabel("running")).toBe("Running");
    expect(eventOverviewStatusTone("failed")).toBe("danger");
    expect(eventOverviewStatusLabel(undefined)).toBe("—");
    expect(eventOverviewStatusTone(undefined)).toBe("neutral");
  });

  it("reuses the canonical event-type tone", () => {
    expect(eventOverviewTypeTone("error")).toBe("danger");
    expect(eventOverviewTypeTone("log")).toBe("neutral");
  });

  it("formats 1-based sequence labels defensively", () => {
    expect(eventOverviewSeqLabel(3)).toBe("#3");
    expect(eventOverviewSeqLabel(0)).toBe("#0");
    expect(eventOverviewSeqLabel(null)).toBe("—");
    expect(eventOverviewSeqLabel(Number.NaN)).toBe("—");
  });

  it("clamps progress into 0..100 and tolerates absent values", () => {
    expect(eventOverviewProgressPercent(0.45)).toBe(45);
    expect(eventOverviewProgressPercent(-2)).toBe(0);
    expect(eventOverviewProgressPercent(5)).toBe(100);
    expect(eventOverviewProgressPercent(null)).toBeNull();
    expect(eventOverviewProgressPercent(Number.NaN)).toBeNull();
  });
});

describe("eventOverviewIdentity", () => {
  it("derives the snapshot header values", () => {
    const identity = eventOverviewIdentity(overview(), NOW);
    expect(identity.typeLabel).toBe("Status");
    expect(identity.typeTone).toBe("info");
    expect(identity.statusLabel).toBe("Running");
    expect(identity.jobLabel).toBe("Job job-aaaa…");
    expect(identity.seqLabel).toBe("#3");
    expect(identity.operationLabel).toBeTruthy();
    expect(identity.projectLabel).toBe("A Short Film");
    expect(identity.messagePreview).toBe("Started frame generation");
    expect(identity.progressPercent).toBe(45);
    expect(identity.emittedLabel).toBe("1 minute ago");
    expect(identity.errorLabel).toBe("");
  });

  it("surfaces an error banner label and zero-fills when absent", () => {
    const withError = eventOverviewIdentity(
      overview({ error: { code: "RENDER", message: " CUDA  out of memory " } }),
      NOW,
    );
    expect(withError.errorLabel).toBe("CUDA out of memory");
    const empty = eventOverviewIdentity(undefined, NOW);
    expect(empty.typeLabel).toBe("Event");
    expect(empty.statusLabel).toBe("—");
    expect(empty.seqLabel).toBe("—");
    expect(empty.progressPercent).toBeNull();
  });
});

describe("eventOverviewStatRows", () => {
  it("returns four zero-filled cards in a stable order", () => {
    const rows = eventOverviewStatRows(overview(), NOW);
    expect(rows.map((row) => row.key)).toEqual(["events", "sequence", "type", "emitted"]);
    expect(rows[0]?.value).toBe("4");
    expect(rows[1]?.value).toBe("#3");
    expect(rows[2]?.value).toBe("Status");
    expect(rows[3]?.value).toBe("1 minute ago");
    const empty = eventOverviewStatRows(undefined, NOW);
    expect(empty.every((row) => row.value === "0" || row.value === "—" || row.value === "Event")).toBe(
      true,
    );
  });
});

describe("eventOverviewTypeRows", () => {
  it("always emits the six canonical zero-filled buckets", () => {
    const rows = eventOverviewTypeRows(overview());
    expect(rows.map((row) => row.type)).toEqual([
      "status",
      "progress",
      "intermediate",
      "result",
      "error",
      "log",
    ]);
    const status = rows.find((row) => row.type === "status");
    const progress = rows.find((row) => row.type === "progress");
    expect(status?.count).toBe(2);
    expect(progress?.count).toBe(2);
    expect(status?.percent).toBe(50);
    expect(rows.find((row) => row.type === "error")?.count).toBe(0);
  });

  it("stays fully zero-filled for an absent snapshot", () => {
    const rows = eventOverviewTypeRows(undefined);
    expect(rows.every((row) => row.count === 0 && row.fraction === 0 && row.percent === 0)).toBe(
      true,
    );
  });
});

describe("eventOverviewRecentSiblings", () => {
  it("maps newest-first siblings and highlights the selected event", () => {
    const rows = eventOverviewRecentSiblings(overview(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "job-aaaa-1111:3",
      seq: 3,
      seqLabel: "#3",
      typeLabel: "Status",
      statusLabel: "Running",
      messagePreview: "Started frame generation",
      progressPercent: 45,
      relativeTime: "1 minute ago",
      isCurrent: true,
    });
  });

  it("does not highlight a sibling from a different sequence or job", () => {
    const rows = eventOverviewRecentSiblings(
      overview({ recent_siblings: [event({ seq: 4 }), event({ seq: 3, job_id: "job-other" })] }),
      NOW,
    );
    expect(rows.every((row) => row.isCurrent === false)).toBe(true);
  });

  it("returns an empty list for an absent snapshot", () => {
    expect(eventOverviewRecentSiblings(undefined, NOW)).toEqual([]);
  });
});

describe("presence and summary helpers", () => {
  it("detects whether a snapshot carries any data", () => {
    expect(hasEventOverviewData(overview())).toBe(true);
    expect(hasEventOverviewData(overview({ counts: { total: 0 }, recent_siblings: [] }))).toBe(false);
    expect(hasEventOverviewData(undefined)).toBe(false);
  });

  it("builds a one-line summary", () => {
    expect(eventOverviewSummaryLabel(overview())).toBe("4 events · selected #3");
    expect(eventOverviewSummaryLabel(undefined)).toBe("");
  });

  it("builds scope-aware empty copy", () => {
    expect(eventOverviewEmptyDescription(true)).toContain("project");
    expect(eventOverviewEmptyDescription(false)).not.toContain("project");
  });
});

describe("eventOverviewPickerOptions", () => {
  it("maps feed items to (jobId, seq) options", () => {
    const options = eventOverviewPickerOptions(feed());
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ jobId: "job-aaaa-1111", seq: 3 });
    expect(options[0]?.value).toBe("job-aaaa-1111:3");
    expect(options[0]?.label).toContain("seq #3");
    expect(options[0]?.label).toContain("Status");
  });

  it("returns no options for an absent feed", () => {
    expect(eventOverviewPickerOptions(undefined)).toEqual([]);
  });

  it("resolves the selected option and falls back to the first row", () => {
    const options = eventOverviewPickerOptions(feed());
    expect(eventOverviewActiveOption(options, "job-aaaa-1111:3")?.seq).toBe(3);
    expect(eventOverviewActiveOption(options, "missing")?.value).toBe("job-aaaa-1111:3");
    expect(eventOverviewActiveOption([], "")).toBeUndefined();
  });
});
