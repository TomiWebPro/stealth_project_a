import { describe, expect, it } from "vitest";
import type { EventStats } from "../../lib/types";
import {
  eventJobLabel,
  eventJobRows,
  eventRelativeLabel,
  eventStatsCards,
  eventStatsGeneratedAtLabel,
  eventTypeCount,
  eventTypeLabel,
  eventTypeRows,
  hasEventStatsData,
  newestEventLabel,
  validEventTypeCount,
} from "./eventStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const populated: EventStats = {
  total_events: 12,
  total_jobs: 3,
  by_type: [
    { type: "status", count: 5 },
    { type: "progress", count: 2 },
    { type: "intermediate", count: 1 },
    { type: "result", count: 1 },
    { type: "error", count: 3 },
    { type: "log", count: 0 },
  ],
  by_job: [
    { job_id: "job-bbbb-1111", events: 2, newest_event_at: "2026-01-01T00:50:00Z" },
    { job_id: "job-aaaa-2222", events: 7, newest_event_at: "2026-01-01T00:45:00Z" },
    { job_id: "job-cccc-3333", events: 3, newest_event_at: "2026-01-01T00:30:00Z" },
  ],
  newest_event_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: EventStats = {
  total_events: 0,
  total_jobs: 0,
  by_type: [
    { type: "status", count: 0 },
    { type: "progress", count: 0 },
    { type: "intermediate", count: 0 },
    { type: "result", count: 0 },
    { type: "error", count: 0 },
    { type: "log", count: 0 },
  ],
  by_job: [],
  newest_event_at: null,
  generated_at: "2026-01-01T00:00:00Z",
};

describe("event stats formatters", () => {
  it("formats relative labels and treats missing or invalid timestamps safely", () => {
    expect(eventRelativeLabel(null)).toBe("");
    expect(eventRelativeLabel(undefined)).toBe("");
    expect(eventRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(eventRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("derives the newest-event label from the snapshot", () => {
    expect(newestEventLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestEventLabel(empty, NOW)).toBe("");
    expect(newestEventLabel(undefined, NOW)).toBe("");
  });

  it("maps canonical event types to human labels", () => {
    expect(eventTypeLabel("status")).toBe("Status");
    expect(eventTypeLabel("progress")).toBe("Progress");
    expect(eventTypeLabel("intermediate")).toBe("Intermediate");
    expect(eventTypeLabel("result")).toBe("Result");
    expect(eventTypeLabel("error")).toBe("Error");
    expect(eventTypeLabel("log")).toBe("Log");
  });

  it("shortens long job ids and handles empty ids for compact rows", () => {
    expect(eventJobLabel("job-aaaa-2222")).toBe("job-aaaa…");
    expect(eventJobLabel("abc")).toBe("abc");
    expect(eventJobLabel("")).toBe("Unknown");
  });

  it("counts events of one canonical type and tolerates malformed buckets", () => {
    expect(eventTypeCount(populated, "error")).toBe(3);
    expect(eventTypeCount(populated, "log")).toBe(0);
    expect(
      eventTypeCount({ ...populated, by_type: [{ type: "error", count: Number.NaN }] }, "error"),
    ).toBe(0);
    expect(eventTypeCount(undefined)).toBe(0);
  });
});

describe("eventStatsCards", () => {
  it("derives totals, error share and recency signals in a stable order", () => {
    const cards = eventStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual(["events", "jobs", "errors", "newest"]);
    expect(cards.map((card) => card.value)).toEqual([
      "12",
      "3",
      "25%",
      "15 minutes ago",
    ]);
    expect(cards[2]?.hint).toBe("3 error events");
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(eventStatsCards(undefined, NOW).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0%",
      "—",
    ]);
    expect(eventStatsCards(empty, NOW).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0%",
      "—",
    ]);
  });
});

describe("eventTypeRows", () => {
  it("returns a complete zero-filled six-type breakdown with shares and tones", () => {
    const rows = eventTypeRows(populated);
    expect(rows.map((row) => row.type)).toEqual([
      "status",
      "progress",
      "intermediate",
      "result",
      "error",
      "log",
    ]);
    expect(rows[0]).toMatchObject({
      label: "Status",
      count: 5,
      percent: 42,
      tone: "info",
    });
    expect(rows[4]).toMatchObject({ label: "Error", count: 3, percent: 25, tone: "danger" });
    expect(rows[5]).toMatchObject({ label: "Log", count: 0, percent: 0, fraction: 0 });
  });

  it("ignores malformed entries and never divides by zero on empty snapshots", () => {
    const rows = eventTypeRows({
      ...populated,
      by_type: [
        { type: "status", count: Number.NaN },
        { type: "error", count: 4 },
      ],
    });
    expect(rows[0]?.count).toBe(0);
    expect(rows[4]?.percent).toBe(100);
    expect(eventTypeRows(undefined).every((row) => row.fraction === 0)).toBe(true);
    expect(eventTypeRows(empty).every((row) => row.percent === 0)).toBe(true);
  });
});

describe("eventJobRows", () => {
  it("orders jobs by descending event count then id with recency and shares", () => {
    const rows = eventJobRows(populated, NOW);
    expect(rows.map((row) => row.jobId)).toEqual([
      "job-aaaa-2222",
      "job-cccc-3333",
      "job-bbbb-1111",
    ]);
    expect(rows[0]).toMatchObject({
      label: "job-aaaa…",
      events: 7,
      newestLabel: "15 minutes ago",
      percent: 58,
    });
  });

  it("returns no rows for absent or empty snapshots and tolerates malformed entries", () => {
    expect(eventJobRows(undefined)).toEqual([]);
    expect(eventJobRows(empty)).toEqual([]);
    expect(
      eventJobRows({
        ...populated,
        by_job: [{ job_id: "p1", events: Number.NaN, newest_event_at: "" }],
      }),
    ).toEqual([]);
  });
});

describe("hasEventStatsData and validEventTypeCount", () => {
  it("detects empty snapshots from the authoritative event total", () => {
    expect(hasEventStatsData(populated)).toBe(true);
    expect(hasEventStatsData(empty)).toBe(false);
    expect(hasEventStatsData(undefined)).toBe(false);
    expect(hasEventStatsData({ ...empty, total_events: 3 })).toBe(true);
  });

  it("counts only well-formed event-type buckets", () => {
    expect(validEventTypeCount(populated)).toBe(6);
    expect(validEventTypeCount(empty)).toBe(6);
    expect(
      validEventTypeCount({ ...populated, by_type: [{ type: "error", count: Number.NaN }] }),
    ).toBe(0);
    expect(validEventTypeCount(undefined)).toBe(0);
  });
});

describe("eventStatsGeneratedAtLabel", () => {
  it("derives a generated-at footer label", () => {
    expect(eventStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(eventStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});
