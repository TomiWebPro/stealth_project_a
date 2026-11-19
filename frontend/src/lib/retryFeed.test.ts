import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { Job, Project } from "./types";
import type { JobRetryRecord } from "./retryStats";
import {
  deriveRetryFeed,
  retryFeedQueryParams,
  UNKNOWN_RETRY_PROJECT_NAME,
  validateRetryFeedArgs,
} from "./retryFeed";

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

function job(
  id: string,
  projectId: string,
  operationId: string,
  createdAt: string,
  finishedAt: string | null = null,
  attempt = 1,
): Job {
  return {
    id,
    project_id: projectId,
    operation_id: operationId,
    schema_version: "1.0.0",
    status: "failed",
    attempt,
    created_by: "user-1",
    created_at: createdAt,
    started_at: createdAt,
    finished_at: finishedAt,
  };
}

const jobs: Job[] = [
  job("job-a", projects[0]!.id, "lora-train", "2026-01-02T00:00:00Z", "2026-01-05T00:00:00Z", 2),
  job("job-b", projects[0]!.id, "dataset-prep", "2026-01-03T00:00:00Z"),
];

const retries: JobRetryRecord[] = [
  { job_id: "job-a" },
  { job_id: "job-a" }, // retried twice
  { job_id: "job-b" },
  { job_id: "job-orphan" }, // excluded
];

describe("deriveRetryFeed", () => {
  it("projects retried jobs with joined names/retry counts, newest-first with a job-id tie-break", () => {
    const feed = deriveRetryFeed(retries, jobs, projects, NOW);
    expect(feed.total).toBe(2);
    expect((feed.items ?? []).map((item) => item.job_id)).toEqual(["job-a", "job-b"]);
    expect(feed.items?.[0]).toMatchObject({
      job_id: "job-a",
      project_id: projects[0]!.id,
      project_name: "Moonshot",
      operation_id: "lora-train",
      status: "failed",
      attempt: 2,
      retries: 2,
      retried_at: "2026-01-05T00:00:00Z", // latest of created/started/finished
    });
    expect(feed.items?.[1]).toMatchObject({ job_id: "job-b", retries: 1 });
    expect(feed.generated_at).toBe(NOW);
  });

  it("skips orphaned ledger entries whose job is missing", () => {
    const feed = deriveRetryFeed(retries, jobs, projects, NOW);
    expect((feed.items ?? []).some((item) => item.job_id === "job-orphan")).toBe(false);
    expect(feed.total).toBe(2);
  });

  it("falls back to a stable project name when the joined project is missing", () => {
    const feed = deriveRetryFeed(retries, jobs, [], NOW);
    expect(feed.items?.[0]?.project_name).toBe(UNKNOWN_RETRY_PROJECT_NAME);
  });

  it("scopes to one project", () => {
    const scoped = deriveRetryFeed(retries, jobs, projects, NOW, { projectId: projects[0]!.id });
    expect(scoped.total).toBe(2);
    const empty = deriveRetryFeed(retries, jobs, projects, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });
  });

  it("bounds the page with a whole-scope total before paging", () => {
    const feed = deriveRetryFeed(retries, jobs, projects, NOW, { limit: 1 });
    expect(feed.total).toBe(2);
    expect(feed.items ?? []).toHaveLength(1);
  });

  it("returns an empty feed for an empty ledger", () => {
    expect(deriveRetryFeed([], jobs, projects, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });
});

describe("validateRetryFeedArgs", () => {
  it("accepts empty options and well-formed scopes/limits", () => {
    expect(() => validateRetryFeedArgs()).not.toThrow();
    expect(() =>
      validateRetryFeedArgs({ projectId: "11111111-1111-4111-8111-111111111111", limit: 200 }),
    ).not.toThrow();
  });

  it("rejects a malformed project id with a 422", () => {
    expect(() => validateRetryFeedArgs({ projectId: "not-a-uuid" })).toThrowError(ApiError);
    try {
      validateRetryFeedArgs({ projectId: "not-a-uuid" });
    } catch (cause) {
      expect(cause).toMatchObject({ status: 422, code: "validation_error" });
    }
  });

  it.each([0, 201, -1, 1.5])("rejects an out-of-range limit (%s) with a 422", (limit) => {
    expect(() => validateRetryFeedArgs({ limit })).toThrowError(ApiError);
  });
});

describe("retryFeedQueryParams", () => {
  it("maps options to the wire query string", () => {
    expect(
      retryFeedQueryParams({ projectId: "11111111-1111-4111-8111-111111111111", limit: 5 }),
    ).toEqual({ project_id: "11111111-1111-4111-8111-111111111111", limit: 5 });
    expect(retryFeedQueryParams()).toEqual({ project_id: undefined, limit: undefined });
  });
});
