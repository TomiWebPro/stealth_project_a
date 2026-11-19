import { describe, expect, it } from "vitest";

import {
  JOB_EVENT_TYPES,
  deriveEventStats,
  eventStatsQueryParams,
  validateEventStatsArgs,
} from "./eventStats";
import type { JobEventRecord } from "./eventStats";
import type { Job, JobEventType } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const J1 = "0b5c1e2a-3000-4000-8000-000000000001";
const J2 = "0b5c1e2a-3000-4000-8000-000000000002";

function event(type: JobEventType, jobId: string, timestamp: string): JobEventRecord {
  return { type, job_id: jobId, timestamp };
}

function job(id: string, projectId: string): Job {
  return {
    id,
    project_id: projectId,
    operation_id: "text-to-image",
    schema_version: "v1",
    status: "running",
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: NOW,
  };
}

const JOBS = [job(J1, P1), job(J2, P2)];

describe("deriveEventStats", () => {
  it("zero-fills every event-type bucket when the event store is empty", () => {
    expect(deriveEventStats([], [], NOW)).toEqual({
      total_events: 0,
      total_jobs: 0,
      by_type: JOB_EVENT_TYPES.map((type) => ({ type, count: 0 })),
      by_job: [],
      newest_event_at: null,
      generated_at: NOW,
    });
  });

  it("counts events by type and per job, finds recency and ignores input order", () => {
    // Unsorted, deliberately newest-last input proves recency is a max, not a head.
    const events = [
      event("status", J1, "2026-03-18T08:00:00.000Z"),
      event("progress", J1, "2026-03-18T09:00:00.000Z"),
      event("progress", J1, "2026-03-18T09:30:00.000Z"),
      event("result", J2, "2026-03-18T07:30:00.000Z"),
      event("error", J2, "2026-03-18T09:15:00.000Z"),
    ];
    const stats = deriveEventStats(events, JOBS, NOW);

    expect(stats.total_events).toBe(5);
    expect(stats.total_jobs).toBe(2);
    expect(stats.by_type).toEqual([
      { type: "status", count: 1 },
      { type: "progress", count: 2 },
      { type: "intermediate", count: 0 },
      { type: "result", count: 1 },
      { type: "error", count: 1 },
      { type: "log", count: 0 },
    ]);
    // J1 has 3 events, J2 has 2 — descending count then job id.
    expect(stats.by_job).toEqual([
      { job_id: J1, events: 3, newest_event_at: "2026-03-18T09:30:00.000Z" },
      { job_id: J2, events: 2, newest_event_at: "2026-03-18T09:15:00.000Z" },
    ]);
    expect(stats.newest_event_at).toBe("2026-03-18T09:30:00.000Z");
    expect(stats.generated_at).toBe(NOW);
    expect(deriveEventStats([...events].reverse(), JOBS, NOW)).toEqual(stats);
  });

  it("breaks per-job ties by job id", () => {
    const stats = deriveEventStats(
      [event("status", J2, "2026-03-18T08:00:00.000Z"), event("log", J1, "2026-03-18T08:00:00.000Z")],
      JOBS,
      NOW,
    );
    expect(stats.by_job?.map((entry) => entry.job_id)).toEqual([J1, J2]);
  });

  it("scopes events to one project, skipping orphan jobs, and zero-fills empty scopes", () => {
    const orphan = "0b5c1e2a-3000-4000-8000-0000000000ff";
    const events = [
      event("status", J1, "2026-03-18T08:00:00.000Z"),
      event("progress", J2, "2026-03-18T09:00:00.000Z"),
      // Global stats include the orphan event; scoped stats must skip it (no job).
      event("log", orphan, "2026-03-18T09:45:00.000Z"),
    ];

    const global = deriveEventStats(events, JOBS, NOW);
    expect(global.total_events).toBe(3);
    expect(global.total_jobs).toBe(3);
    expect(global.newest_event_at).toBe("2026-03-18T09:45:00.000Z");

    const scoped = deriveEventStats(events, JOBS, NOW, { projectId: P1 });
    expect(scoped.total_events).toBe(1);
    expect(scoped.total_jobs).toBe(1);
    expect(scoped.by_job).toEqual([
      { job_id: J1, events: 1, newest_event_at: "2026-03-18T08:00:00.000Z" },
    ]);
    expect(scoped.newest_event_at).toBe("2026-03-18T08:00:00.000Z");

    const empty = deriveEventStats(events, JOBS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_events).toBe(0);
    expect(empty.total_jobs).toBe(0);
    expect(empty.by_type?.every((bucket) => bucket.count === 0)).toBe(true);
    expect(empty.by_job).toEqual([]);
    expect(empty.newest_event_at).toBeNull();
  });
});

describe("event stats query helpers", () => {
  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateEventStatsArgs()).not.toThrow();
    expect(() => validateEventStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateEventStatsArgs({ projectId: "not-a-uuid" });
      throw new Error("expected validation to fail");
    } catch (cause) {
      expect(cause).toMatchObject({
        status: 422,
        code: "validation_error",
        details: [{ field: "project_id" }],
      });
    }
  });

  it("maps the project scope onto the live query string", () => {
    expect(eventStatsQueryParams()).toEqual({ project_id: undefined });
    expect(eventStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
