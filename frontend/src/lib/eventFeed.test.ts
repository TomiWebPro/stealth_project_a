import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { Job, JobEvent, Project } from "./types";
import {
  deriveEventFeed,
  eventFeedQueryParams,
  UNKNOWN_EVENT_PROJECT_NAME,
  validateEventFeedArgs,
} from "./eventFeed";

const NOW = "2026-11-19T12:00:00Z";

const projects: Project[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Moonshot",
    org_id: "aaaaaaaa-1111-4111-8111-111111111111",
    description: null,
    archived: false,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

function job(id: string, projectId: string, operationId: string): Job {
  return {
    id,
    project_id: projectId,
    operation_id: operationId,
    schema_version: "1.0.0",
    status: "running",
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
  };
}

const jobs: Job[] = [
  job("job-a", projects[0]!.id, "dataset-prep"),
  job("job-b", projects[0]!.id, "lora-train"),
];

const events: JobEvent[] = [
  {
    job_id: "job-a",
    seq: 0,
    type: "status",
    status: "running",
    message: "started",
    timestamp: "2026-01-02T00:00:00Z",
  },
  {
    job_id: "job-a",
    seq: 1,
    type: "progress",
    progress: 0.5,
    timestamp: "2026-01-03T00:00:00Z",
  },
  {
    job_id: "job-b",
    seq: 0,
    type: "error",
    status: "failed",
    error: { code: "TRAIN_OOM", message: "out of memory", retryable: true },
    timestamp: "2026-01-03T00:00:00Z",
  },
  {
    job_id: "job-orphan",
    seq: 0,
    type: "log",
    timestamp: "2026-01-04T00:00:00Z",
  },
];

describe("deriveEventFeed", () => {
  it("joins events to jobs/projects and orders newest-first with a (job_id, seq) tie-break", () => {
    const feed = deriveEventFeed(events, jobs, projects, NOW);
    expect(feed.total).toBe(3);
    expect((feed.items ?? []).map((item) => [item.job_id, item.seq])).toEqual([
      ["job-b", 0],
      ["job-a", 1],
      ["job-a", 0],
    ]);
    expect(feed.items?.[0]).toMatchObject({
      type: "error",
      operation_id: "lora-train",
      project_id: projects[0]!.id,
      project_name: "Moonshot",
      status: "failed",
      progress: null,
      message: null,
      asset_id: null,
      error: { code: "TRAIN_OOM", retryable: true },
    });
    expect(feed.items?.[2]?.message).toBe("started");
    expect(feed.generated_at).toBe(NOW);
  });

  it("skips orphan events whose job is missing", () => {
    const feed = deriveEventFeed(events, jobs, projects, NOW);
    expect((feed.items ?? []).some((item) => item.job_id === "job-orphan")).toBe(false);
    expect(feed.total).toBe(3);
  });

  it("falls back to a stable project name when the joined project is missing", () => {
    const feed = deriveEventFeed(events, jobs, [], NOW);
    expect(feed.items?.[0]?.project_name).toBe(UNKNOWN_EVENT_PROJECT_NAME);
  });

  it("scopes to one project", () => {
    const feed = deriveEventFeed(events, jobs, projects, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(feed).toEqual({ items: [], total: 0, generated_at: NOW });
    expect(deriveEventFeed(events, jobs, projects, NOW, { projectId: projects[0]!.id }).total).toBe(3);
  });

  it("filters to one event type", () => {
    const feed = deriveEventFeed(events, jobs, projects, NOW, { type: "progress" });
    expect(feed.total).toBe(1);
    expect(feed.items?.[0]).toMatchObject({ job_id: "job-a", seq: 1, type: "progress", progress: 0.5 });
  });

  it("bounds the page with a whole-scope total before paging", () => {
    const feed = deriveEventFeed(events, jobs, projects, NOW, { limit: 2 });
    expect(feed.total).toBe(3);
    expect(feed.items ?? []).toHaveLength(2);
  });

  it("returns an empty feed for an empty event stream", () => {
    expect(deriveEventFeed([], jobs, projects, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });
});

describe("validateEventFeedArgs", () => {
  it("accepts empty options and well-formed scopes, filters and limits", () => {
    expect(() => validateEventFeedArgs()).not.toThrow();
    expect(() =>
      validateEventFeedArgs({
        projectId: "11111111-1111-4111-8111-111111111111",
        type: "status",
        limit: 200,
      }),
    ).not.toThrow();
  });

  it("rejects a malformed project id with a 422", () => {
    expect(() => validateEventFeedArgs({ projectId: "not-a-uuid" })).toThrowError(ApiError);
    try {
      validateEventFeedArgs({ projectId: "not-a-uuid" });
    } catch (cause) {
      expect(cause).toMatchObject({ status: 422, code: "validation_error" });
    }
  });

  it("rejects an unknown event type with a 422", () => {
    expect(() => validateEventFeedArgs({ type: "bogus" as never })).toThrowError(ApiError);
  });

  it.each([0, 201, -1, 1.5])("rejects an out-of-range limit (%s) with a 422", (limit) => {
    expect(() => validateEventFeedArgs({ limit })).toThrowError(ApiError);
  });
});

describe("eventFeedQueryParams", () => {
  it("maps options to the wire query string", () => {
    expect(
      eventFeedQueryParams({
        projectId: "11111111-1111-4111-8111-111111111111",
        type: "error",
        limit: 5,
      }),
    ).toEqual({
      project_id: "11111111-1111-4111-8111-111111111111",
      type: "error",
      limit: 5,
    });
    expect(eventFeedQueryParams()).toEqual({ project_id: undefined, type: undefined, limit: undefined });
  });
});
