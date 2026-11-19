import { describe, expect, it } from "vitest";

import {
  deriveJobLogs,
  jobLogsQueryParams,
  LOG_LEVEL_BY_TYPE,
  logLevelForEvent,
  validateJobLogsArgs,
} from "./jobLogs";
import type { JobEvent, JobEventType } from "./types";

const JOB = "0b5c1e2a-3000-4000-8000-000000000016";

function event(
  type: JobEventType,
  seq: number,
  extra: Partial<JobEvent> = {},
): JobEvent {
  return {
    type,
    job_id: JOB,
    seq,
    timestamp: `2026-03-18T10:${String(seq).padStart(2, "0")}:00.000Z`,
    ...extra,
  };
}

const EVENTS: readonly JobEvent[] = [
  event("status", 0, { status: "running", message: "Training started" }),
  event("progress", 1, { progress: 0.31, message: "step 310/1000" }),
  event("intermediate", 2, { message: "checkpoint saved", asset_id: "0b5c1e2a-2000-4000-8000-000000000011" }),
  event("error", 3, {
    message: "VRAM exhausted",
    error: { code: "TRAIN_OOM", message: "24 GB VRAM exhausted", retryable: true },
  }),
  event("log", 4, { message: "worker released" }),
  // Deliberately out of order to prove the derivation sorts by seq.
  event("result", 6, { status: "succeeded", message: "done" }),
  event("progress", 5, { progress: 0.99 }),
];

describe("log level mapping", () => {
  it("maps every canonical event type to a console severity", () => {
    expect(LOG_LEVEL_BY_TYPE).toEqual({
      status: "info",
      progress: "debug",
      intermediate: "info",
      result: "success",
      error: "error",
      log: "info",
    });
    expect(logLevelForEvent("error")).toBe("error");
  });

  it("defaults an unknown event type to info", () => {
    expect(logLevelForEvent("mystery" as JobEventType)).toBe("info");
  });
});

describe("deriveJobLogs", () => {
  it("returns an empty frame for a stream with no events", () => {
    expect(deriveJobLogs(JOB, [])).toEqual({
      job_id: JOB,
      entries: [],
      next_seq: 0,
      total: 0,
    });
  });

  it("projects and sorts every event with null placeholders for absent fields", () => {
    const frame = deriveJobLogs(JOB, EVENTS);

    expect(frame.job_id).toBe(JOB);
    expect(frame.total).toBe(7);
    expect(frame.entries!.map((entry) => entry.seq)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(frame.next_seq).toBe(7);
    expect(frame.entries![0]).toMatchObject({
      type: "status",
      level: "info",
      status: "running",
      message: "Training started",
      progress: null,
      asset_id: null,
      error: null,
    });
    expect(frame.entries![3]).toMatchObject({ level: "error", message: "VRAM exhausted" });
    expect(frame.entries![5]).toMatchObject({ level: "debug", progress: 0.99 });
    expect(frame.entries![6]).toMatchObject({ level: "success", status: "succeeded" });
  });

  it("filters by severity while keeping total stream-wide", () => {
    const debug = deriveJobLogs(JOB, EVENTS, { level: "debug" });
    expect(debug.entries!.map((entry) => entry.seq)).toEqual([1, 5]);
    expect(debug.total).toBe(2);
    expect(debug.next_seq).toBe(6);

    const info = deriveJobLogs(JOB, EVENTS, { level: "info" });
    expect(info.entries!.map((entry) => entry.seq)).toEqual([0, 2, 4]);
    expect(info.total).toBe(3);
    expect(deriveJobLogs(JOB, EVENTS, { level: "success" }).entries!.map((e) => e.seq)).toEqual([6]);
  });

  it("applies the resume cursor and page limit with a resume next_seq", () => {
    const page = deriveJobLogs(JOB, EVENTS, { sinceSeq: 3, limit: 2 });
    expect(page.entries!.map((entry) => entry.seq)).toEqual([3, 4]);
    expect(page.total).toBe(7);
    expect(page.next_seq).toBe(5);

    const resumed = deriveJobLogs(JOB, EVENTS, { sinceSeq: page.next_seq, limit: 2 });
    expect(resumed.entries!.map((entry) => entry.seq)).toEqual([5, 6]);
    expect(resumed.next_seq).toBe(7);

    const pastEnd = deriveJobLogs(JOB, EVENTS, { sinceSeq: 99 });
    expect(pastEnd.entries).toEqual([]);
    expect(pastEnd.next_seq).toBe(99);
    expect(pastEnd.total).toBe(7);
  });
});

describe("job log query helpers", () => {
  it("mirrors router validation for malformed ids, levels and bounds", () => {
    expect(() => validateJobLogsArgs(JOB)).not.toThrow();
    expect(() => validateJobLogsArgs(JOB, { level: "error", sinceSeq: 0, limit: 200 })).not.toThrow();

    for (const [args, field] of [
      [{ jobId: "not-a-uuid" }, "job_id"],
      [{ jobId: JOB, options: { level: "verbose" as never } }, "level"],
      [{ jobId: JOB, options: { sinceSeq: -1 } }, "since_seq"],
      [{ jobId: JOB, options: { limit: 0 } }, "limit"],
      [{ jobId: JOB, options: { limit: 201 } }, "limit"],
    ] as const) {
      try {
        validateJobLogsArgs(args.jobId, "options" in args ? args.options : undefined);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({
          status: 422,
          code: "validation_error",
          details: [{ field }],
        });
      }
    }
  });

  it("maps options onto the live query string", () => {
    expect(jobLogsQueryParams()).toEqual({ level: undefined, since_seq: undefined, limit: undefined });
    expect(jobLogsQueryParams({ level: "error", sinceSeq: 3, limit: 10 })).toEqual({
      level: "error",
      since_seq: 3,
      limit: 10,
    });
  });
});
