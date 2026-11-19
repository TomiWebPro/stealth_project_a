import { describe, expect, it } from "vitest";
import type { JobLogEntry, JobLogFrame } from "../../lib/types";
import {
  LOG_LEVEL_FILTERS,
  buildJobLogsOptions,
  canLoadNewer,
  canLoadOlder,
  eventTypeLabel,
  hasLogEntries,
  jobOptionLabel,
  logEntryDetail,
  logEntryMessage,
  logEntryRows,
  logEntryTimeLabel,
  logLevelFilterLabel,
  logLevelLabel,
  logLevelOptions,
  logLevelTone,
  logPageLabel,
} from "./jobLogHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

function entry(overrides: Partial<JobLogEntry> = {}): JobLogEntry {
  return {
    seq: 1,
    type: "status",
    level: "info",
    message: null,
    status: null,
    progress: null,
    asset_id: null,
    error: null,
    timestamp: "2026-01-01T00:59:30Z",
    ...overrides,
  };
}

describe("job log level helpers", () => {
  it("labels and tones every coarse level", () => {
    expect(logLevelLabel("debug")).toBe("Debug");
    expect(logLevelLabel("info")).toBe("Info");
    expect(logLevelLabel("success")).toBe("Success");
    expect(logLevelLabel("error")).toBe("Error");
    expect(logLevelTone("debug")).toBe("neutral");
    expect(logLevelTone("info")).toBe("info");
    expect(logLevelTone("success")).toBe("success");
    expect(logLevelTone("error")).toBe("danger");
  });

  it("maps event types to human labels", () => {
    expect(eventTypeLabel("status")).toBe("Status");
    expect(eventTypeLabel("progress")).toBe("Progress");
    expect(eventTypeLabel("intermediate")).toBe("Intermediate");
    expect(eventTypeLabel("result")).toBe("Result");
    expect(eventTypeLabel("error")).toBe("Error");
    expect(eventTypeLabel("log")).toBe("Log");
  });

  it("exposes all five filter chips with their labels", () => {
    expect(LOG_LEVEL_FILTERS).toEqual(["all", "debug", "info", "success", "error"]);
    expect(logLevelFilterLabel("all")).toBe("All levels");
    expect(logLevelFilterLabel("error")).toBe("Error");
    expect(logLevelOptions().map((option) => option.value)).toEqual([...LOG_LEVEL_FILTERS]);
    expect(logLevelOptions().map((option) => option.label)).toEqual([
      "All levels",
      "Debug",
      "Info",
      "Success",
      "Error",
    ]);
  });

  it("builds query options, omitting level for the all filter", () => {
    expect(buildJobLogsOptions("all", 5, 25)).toEqual({ sinceSeq: 5, limit: 25 });
    expect(buildJobLogsOptions("error")).toEqual({ level: "error", sinceSeq: 0, limit: 50 });
    expect(buildJobLogsOptions("debug", 3, 10)).toEqual({
      level: "debug",
      sinceSeq: 3,
      limit: 10,
    });
  });
});

describe("job log line derivation", () => {
  it("prefers a trimmed event message", () => {
    expect(logEntryMessage(entry({ message: "  Starting job  " }))).toBe("Starting job");
  });

  it("falls back to the error payload then to the type label", () => {
    expect(
      logEntryMessage(entry({ type: "error", error: { code: "E_X", message: "Boom" } })),
    ).toBe("E_X: Boom");
    expect(logEntryMessage(entry({ type: "result" }))).toBe("Result event");
  });

  it("derives compact context from progress, status and asset id", () => {
    expect(logEntryDetail(entry({ progress: 0.456, status: "running", asset_id: "abc-12345-def" }))).toBe(
      "progress 46% · status running · asset abc-1234",
    );
    expect(logEntryDetail(entry())).toBe("");
    expect(logEntryDetail(entry({ progress: 5 }))).toBe("progress 100%");
  });

  it("formats relative timestamps and tolerates missing/invalid ones", () => {
    expect(logEntryTimeLabel(entry(), NOW)).toBe("30 seconds ago");
    expect(logEntryTimeLabel(entry({ timestamp: "" }), NOW)).toBe("");
    expect(logEntryTimeLabel(entry({ timestamp: "not-a-date" }), NOW)).toBe("not-a-date");
  });

  it("maps, sorts and guards rows for a populated frame", () => {
    const entries = [
      entry({ seq: 3, level: "success", type: "result", message: "Done" }),
      entry({ seq: 1, level: "info", type: "status", message: "Queued" }),
      entry({ seq: 2, level: "error", type: "error", error: { code: "E", message: "bad" } }),
    ];
    const rows = logEntryRows(entries, NOW);
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3]);
    expect(rows[1]?.level).toBe("error");
    expect(rows[1]?.levelTone).toBe("danger");
    expect(rows[1]?.message).toBe("E: bad");
    expect(rows[2]?.typeLabel).toBe("Result");
    expect(rows[0]?.timeLabel).toBe("30 seconds ago");
  });

  it("returns no rows for undefined or malformed entries", () => {
    expect(logEntryRows(undefined)).toEqual([]);
    expect(
      logEntryRows([
        entry({ seq: Number.NaN }),
        entry({ seq: 2 }),
      ]),
    ).toHaveLength(1);
  });
});

describe("job log frame state", () => {
  const frame = (entries: JobLogEntry[], total = 9, next_seq = 4): JobLogFrame => ({
    job_id: "job-1",
    entries,
    total,
    next_seq,
  });

  it("detects empty versus populated frames", () => {
    expect(hasLogEntries(undefined)).toBe(false);
    expect(hasLogEntries(frame([]))).toBe(false);
    expect(hasLogEntries({ job_id: "job-1" })).toBe(false);
    expect(hasLogEntries(frame([entry()]))).toBe(true);
  });

  it("derives a stable page range label", () => {
    expect(logPageLabel(frame([entry({ seq: 3 }), entry({ seq: 5 })]))).toBe("Seq 3–5 of 9");
    expect(logPageLabel(frame([]))).toBe("");
    expect(logPageLabel(undefined)).toBe("");
  });

  it("loads newer only for a full page and older only with cursor history", () => {
    expect(canLoadNewer(frame([entry({ seq: 1 }), entry({ seq: 2 })], 9, 3), 2)).toBe(true);
    expect(canLoadNewer(frame([entry({ seq: 1 })], 9, 2), 2)).toBe(false);
    expect(canLoadNewer(undefined, 2)).toBe(false);
    expect(canLoadOlder([])).toBe(false);
    expect(canLoadOlder([0, 3])).toBe(true);
  });

  it("labels jobs for the picker", () => {
    expect(jobOptionLabel({ id: "abcdefgh-1234", operation_id: "lora-train" })).toBe(
      "lora-train · abcdefgh",
    );
  });
});
