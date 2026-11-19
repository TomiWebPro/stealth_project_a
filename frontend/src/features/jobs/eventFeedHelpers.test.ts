import { describe, expect, it } from "vitest";
import type { EventFeed, EventFeedItem } from "../../lib/types";
import {
  buildEventFeedOptions,
  eventFeedEmptyDescription,
  eventFeedGeneratedAtLabel,
  eventFeedMessage,
  eventFeedMessageExcerpt,
  eventFeedProgressPercent,
  eventFeedRows,
  eventFeedSummary,
  eventFeedTone,
  eventFeedTypeChipLabel,
  EVENT_FEED_LIMITS,
  EVENT_FEED_TYPE_FILTERS,
} from "./eventFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function item(overrides: Partial<EventFeedItem> = {}): EventFeedItem {
  return {
    job_id: "job-aaaa-1111",
    seq: 1,
    type: "status",
    operation_id: "dataset-prep",
    project_id: "proj-aaaa-2222",
    project_name: "A Short Film",
    status: "running",
    progress: 0.42,
    message: "started\n  training",
    asset_id: null,
    error: null,
    timestamp: "2026-01-01T00:45:00Z",
    ...overrides,
  };
}

function feed(items: readonly EventFeedItem[], total = items.length): EventFeed {
  return { items: [...items], total, generated_at: "2026-01-01T00:59:00Z" };
}

describe("buildEventFeedOptions", () => {
  it("omits both scopes when unscoped", () => {
    expect(buildEventFeedOptions(undefined, undefined, 25)).toEqual({ limit: 25 });
  });

  it("includes the project and type scopes when provided", () => {
    expect(buildEventFeedOptions("proj-aaaa-2222", "error", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      type: "error",
      limit: 10,
    });
  });

  it("offers the canonical page sizes and event-type chips", () => {
    expect(EVENT_FEED_LIMITS).toEqual([10, 25, 50]);
    expect(EVENT_FEED_TYPE_FILTERS).toEqual([
      undefined,
      "status",
      "progress",
      "intermediate",
      "result",
      "error",
      "log",
    ]);
  });
});

describe("eventFeedTypeChipLabel", () => {
  it("labels the unfiltered chip and canonical event types", () => {
    expect(eventFeedTypeChipLabel(undefined)).toBe("All");
    expect(eventFeedTypeChipLabel("status")).toBe("Status");
    expect(eventFeedTypeChipLabel("error")).toBe("Error");
  });
});

describe("eventFeedTone", () => {
  it("uses the canonical type tones", () => {
    expect(eventFeedTone("status")).toBe("info");
    expect(eventFeedTone("progress")).toBe("accent");
    expect(eventFeedTone("result")).toBe("success");
    expect(eventFeedTone("error")).toBe("danger");
    expect(eventFeedTone("log")).toBe("neutral");
  });
});

describe("eventFeedProgressPercent", () => {
  it("converts a 0..1 signal to a rounded percentage", () => {
    expect(eventFeedProgressPercent(0)).toBe(0);
    expect(eventFeedProgressPercent(0.42)).toBe(42);
    expect(eventFeedProgressPercent(1)).toBe(100);
  });

  it("clamps out-of-range values and tolerates absent/non-finite signals", () => {
    expect(eventFeedProgressPercent(-1)).toBe(0);
    expect(eventFeedProgressPercent(2)).toBe(100);
    expect(eventFeedProgressPercent(Number.NaN)).toBeNull();
    expect(eventFeedProgressPercent(null)).toBeNull();
    expect(eventFeedProgressPercent(undefined)).toBeNull();
  });
});

describe("eventFeedMessage / eventFeedMessageExcerpt", () => {
  it("normalizes whitespace in a message", () => {
    expect(eventFeedMessage(item())).toBe("started training");
  });

  it("falls back to the error message when no message is present", () => {
    expect(eventFeedMessage(item({ message: null, error: { code: "E", message: " disk  full " } }))).toBe(
      "disk full",
    );
    expect(eventFeedMessage(item({ message: null, error: null }))).toBe("");
  });

  it("truncates long messages with an ellipsis", () => {
    const long = item({ message: "x".repeat(200) });
    expect(eventFeedMessageExcerpt(long)).toBe(`${"x".repeat(119)}…`);
    expect(eventFeedMessageExcerpt(long, 10)).toBe("xxxxxxxxx…");
  });
});

describe("eventFeedRows", () => {
  it("returns an empty list for an unset or failed feed", () => {
    expect(eventFeedRows(undefined, NOW)).toEqual([]);
    expect(eventFeedRows({ total: 3, generated_at: "2026-01-01T00:59:00Z" }, NOW)).toEqual([]);
  });

  it("derives render-ready rows while preserving newest-first order", () => {
    const rows = eventFeedRows(
      feed([
        item(),
        item({
          job_id: "job-bbbb-2222",
          seq: 7,
          type: "error",
          status: "failed",
          progress: null,
          message: null,
          error: { code: "E42", message: "render failed" },
          project_id: "proj-bbbb-3333",
          project_name: "Trailer",
          operation_id: "video_gen",
          timestamp: "2026-01-01T00:20:00Z",
        }),
      ]),
      NOW,
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(["job-aaaa-1111:1", "job-bbbb-2222:7"]);
    expect(rows[0]).toMatchObject({
      jobId: "job-aaaa-1111",
      jobLabel: "job-aaaa…",
      seq: 1,
      type: "status",
      typeLabel: "Status",
      tone: "info",
      operationId: "dataset-prep",
      operationLabel: "Dataset Prep",
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      statusLabel: "Running",
      statusTone: "info",
      progressPercent: 42,
      message: "started training",
      timestamp: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      type: "error",
      tone: "danger",
      operationLabel: "Video Gen",
      statusLabel: "Failed",
      statusTone: "danger",
      progressPercent: null,
      message: "render failed",
    });
  });

  it("tolerates events with no status, progress or message", () => {
    const [row] = eventFeedRows(
      feed([item({ status: null, progress: null, message: null, error: null })]),
      NOW,
    );
    expect(row).toMatchObject({
      statusLabel: "",
      statusTone: undefined,
      progressPercent: null,
      message: "",
    });
  });
});

describe("eventFeedSummary", () => {
  it("describes an empty feed", () => {
    expect(eventFeedSummary([], 0)).toBe("No events");
  });

  it("uses the untruncated total and the newest event type", () => {
    const rows = eventFeedRows(feed([item()]), NOW);
    expect(eventFeedSummary(rows, 99)).toBe("99 events · latest: Status");
    expect(eventFeedSummary(rows)).toBe("1 event · latest: Status");
  });
});

describe("eventFeedGeneratedAtLabel", () => {
  it("is empty when absent and relative when present", () => {
    expect(eventFeedGeneratedAtLabel(undefined, NOW)).toBe("");
    expect(eventFeedGeneratedAtLabel(feed([]), NOW)).toBe("1 minute ago");
  });
});

describe("eventFeedEmptyDescription", () => {
  it("is filter- and scope-aware", () => {
    expect(eventFeedEmptyDescription(false, true)).toContain("type filter");
    expect(eventFeedEmptyDescription(true, false)).toContain("this project");
    expect(eventFeedEmptyDescription(false, false)).toContain("Job events");
  });
});
