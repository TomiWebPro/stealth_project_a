import { describe, expect, it } from "vitest";

import { REFERENCE_NOW } from "./mock/data";
import type { Job, JobEvent, Project } from "./types";
import {
  DEFAULT_EVENT_OVERVIEW_RECENT_LIMIT,
  deriveEventOverview,
  eventOverviewQueryParams,
  validateEventOverviewArgs,
} from "./eventOverview";
import type { EventOverviewSeeds } from "./eventOverview";

const JOB_A = "0b5c1e2a-3000-4000-8000-000000000001";
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    org_id: "0b5c1e2a-0000-4000-8000-00000000000a",
    name: `project-${id}`,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    project_id: PROJECT_A,
    operation_id: "text-to-image",
    schema_version: "v1",
    status: "running",
    progress: 0.5,
    result: null,
    error: null,
    attempt: 1,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    started_at: "2026-01-01T00:00:00.000Z",
    finished_at: null,
    ...overrides,
  };
}

function event(seq: number, overrides: Partial<JobEvent> = {}): JobEvent {
  return {
    type: "status",
    job_id: JOB_A,
    seq,
    timestamp: `2026-01-0${seq + 1}T00:00:00.000Z`,
    status: "running",
    message: `event-${seq}`,
    ...overrides,
  };
}

function seeds(overrides: Partial<EventOverviewSeeds> = {}): EventOverviewSeeds {
  return {
    jobs: [job(JOB_A)],
    events: [],
    projects: [project(PROJECT_A)],
    now: REFERENCE_NOW,
    ...overrides,
  };
}

const STREAM = [
  event(0, { type: "status", status: "running" }),
  event(1, { type: "progress", progress: 0.3 }),
  event(2, { type: "log", progress: 0.62, timestamp: "2026-01-03T00:00:00.000Z" }),
];

describe("deriveEventOverview", () => {
  it("projects one event's identity joined to its job/contract context", () => {
    const overview = deriveEventOverview(
      JOB_A,
      1,
      seeds({
        jobs: [job(JOB_A, { operation_id: "image-to-video" })],
        projects: [project(PROJECT_A, { name: "Moonshot" })],
        events: STREAM,
      }),
    );
    expect(overview.job_id).toBe(JOB_A);
    expect(overview.seq).toBe(1);
    expect(overview.type).toBe("progress");
    expect(overview.operation_id).toBe("image-to-video");
    expect(overview.project_id).toBe(PROJECT_A);
    expect(overview.project_name).toBe("Moonshot");
    expect(overview.progress).toBe(0.3);
    expect(overview.message).toBe("event-1");
    expect(overview.generated_at).toBe(REFERENCE_NOW);
  });

  it("counts the whole job into zero-filled by_type buckets, excluding other jobs", () => {
    const overview = deriveEventOverview(
      JOB_A,
      0,
      seeds({
        events: [
          ...STREAM,
          event(3, { type: "error", status: "failed" }),
          event(0, { job_id: "other-job", type: "result" }),
        ],
      }),
    );
    expect(overview.counts.total).toBe(4);
    expect(overview.counts.by_type).toEqual([
      { type: "status", count: 1 },
      { type: "progress", count: 1 },
      { type: "intermediate", count: 0 },
      { type: "result", count: 0 },
      { type: "error", count: 1 },
      { type: "log", count: 1 },
    ]);
  });

  it("breaks timestamp ties by seq for a deterministic newest-first page", () => {
    const tied = seeds({
      events: [
        event(0, { timestamp: "2026-01-01T00:00:00.000Z" }),
        event(1, { timestamp: "2026-01-01T00:00:00.000Z" }),
        event(2, { timestamp: "2026-01-01T00:00:00.000Z" }),
      ],
    });
    const overview = deriveEventOverview(JOB_A, 0, tied);
    expect(overview.recent_siblings?.map((item) => item.seq)).toEqual([2, 1, 0]);
  });

  it("emits newest-first siblings bounded by recent_limit without bounding counts", () => {
    const whole = deriveEventOverview(JOB_A, 0, seeds({ events: STREAM }));
    const limited = deriveEventOverview(JOB_A, 0, seeds({ events: STREAM }), { recentLimit: 2 });
    expect(whole.recent_siblings?.map((item) => item.seq)).toEqual([2, 1, 0]);
    expect(limited.recent_siblings?.map((item) => item.seq)).toEqual([2, 1]);
    expect(limited.counts).toEqual(whole.counts);
  });

  it("uses an Unknown project fallback for an unseeded project", () => {
    const overview = deriveEventOverview(
      JOB_A,
      0,
      seeds({
        jobs: [job(JOB_A, { project_id: UNKNOWN_ID })],
        events: [event(0)],
        projects: [],
      }),
    );
    expect(overview.project_name).toBe("Unknown project");
  });

  it("throws job_not_found for an unknown job", () => {
    expect(() => deriveEventOverview(UNKNOWN_ID, 0, seeds())).toThrowError(
      expect.objectContaining({ status: 404, code: "job_not_found" }),
    );
  });

  it("throws event_not_found when the sequence is absent from the job", () => {
    expect(() => deriveEventOverview(JOB_A, 99, seeds({ events: STREAM }))).toThrowError(
      expect.objectContaining({ status: 404, code: "event_not_found" }),
    );
    // A sequence that belongs to another job is never mistaken for one here.
    expect(() =>
      deriveEventOverview(JOB_A, 0, seeds({ events: [event(0, { job_id: "other-job" })] })),
    ).toThrowError(expect.objectContaining({ status: 404, code: "event_not_found" }));
  });
});

describe("validateEventOverviewArgs", () => {
  it("accepts a well-formed job id, sequence and recent limit", () => {
    expect(() =>
      validateEventOverviewArgs(JOB_A, 2, { recentLimit: DEFAULT_EVENT_OVERVIEW_RECENT_LIMIT }),
    ).not.toThrow();
    expect(() => validateEventOverviewArgs(JOB_A, 0)).not.toThrow();
  });

  it("rejects a malformed job id", () => {
    expect(() => validateEventOverviewArgs("not-a-uuid", 0)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it("rejects a negative or non-integer sequence", () => {
    for (const seq of [-1, 1.5]) {
      expect(() => validateEventOverviewArgs(JOB_A, seq)).toThrowError(
        expect.objectContaining({ status: 422, code: "validation_error" }),
      );
    }
  });

  it("rejects an out-of-range recent limit", () => {
    for (const recentLimit of [0, 51, -1, 1.5]) {
      expect(() => validateEventOverviewArgs(JOB_A, 0, { recentLimit })).toThrowError(
        expect.objectContaining({ status: 422, code: "validation_error" }),
      );
    }
  });
});

describe("eventOverviewQueryParams", () => {
  it("maps the recent limit to the wire query param", () => {
    expect(eventOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(eventOverviewQueryParams({ recentLimit: 3 })).toEqual({ recent_limit: 3 });
  });
});
