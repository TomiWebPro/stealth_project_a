import { describe, expect, it } from "vitest";

import {
  deriveJobFeed,
  jobFeedQueryParams,
  UNKNOWN_JOB_PROJECT_NAME,
  validateJobFeedArgs,
} from "./jobFeed";
import type { Job, JobStatus, Project } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const J1 = "0b5c1e2a-3000-4000-8000-000000000001";
const J2 = "0b5c1e2a-3000-4000-8000-000000000002";
const J3 = "0b5c1e2a-3000-4000-8000-000000000003";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
];

function job(
  id: string,
  projectId: string,
  createdAt: string,
  status: JobStatus = "running",
  overrides: Partial<Job> = {},
): Job {
  return {
    id,
    project_id: projectId,
    operation_id: "lora-train",
    schema_version: "v1",
    status,
    progress: 0.5,
    attempt: 2,
    created_by: "user",
    created_at: createdAt,
    started_at: createdAt,
    finished_at: null,
    ...overrides,
  };
}

const JOBS: readonly Job[] = [
  job(J1, P1, "2026-03-18T08:00:00.000Z", "running", { operation_id: "dataset-prep" }),
  job(J2, P2, "2026-03-18T09:00:00.000Z", "succeeded", {
    operation_id: "image-to-video",
    progress: 1,
    finished_at: "2026-03-18T09:30:00.000Z",
  }),
  job(J3, P2, "2026-03-18T08:00:00.000Z", "failed"),
];

describe("deriveJobFeed", () => {
  it("returns an empty feed when there are no jobs", () => {
    expect(deriveJobFeed([], PROJECTS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with a job-id tie-break and joins project names", () => {
    const feed = deriveJobFeed([...JOBS].reverse(), PROJECTS, NOW);

    expect(feed.total).toBe(3);
    expect(feed.generated_at).toBe(NOW);
    expect((feed.items ?? []).map((item) => item.job_id)).toEqual([J2, J3, J1]);
    expect((feed.items ?? [])[0]).toMatchObject({
      job_id: J2,
      project_id: P2,
      project_name: "Brand Film",
      operation_id: "image-to-video",
      status: "succeeded",
      progress: 1,
      attempt: 2,
      created_by: "user",
      started_at: "2026-03-18T09:00:00.000Z",
      finished_at: "2026-03-18T09:30:00.000Z",
    });
    expect(deriveJobFeed(JOBS, PROJECTS, NOW)).toEqual(feed);
  });

  it("breaks created-at ties by descending job id", () => {
    const tied = [
      job(J1, P1, "2026-03-18T08:00:00.000Z"),
      job(J2, P1, "2026-03-18T08:00:00.000Z"),
    ];
    expect(
      deriveJobFeed(tied, PROJECTS, NOW).items?.map((item) => item.job_id),
    ).toEqual([J2, J1]);
  });

  it("defaults missing progress/attempt to 0/1 and timestamps to null", () => {
    const minimal = job(J1, P1, NOW, "queued", {
      progress: undefined,
      attempt: undefined,
      started_at: undefined,
      finished_at: undefined,
    });
    const feed = deriveJobFeed([minimal], PROJECTS, NOW);
    expect((feed.items ?? [])[0]).toMatchObject({
      job_id: J1,
      status: "queued",
      progress: 0,
      attempt: 1,
      started_at: null,
      finished_at: null,
    });
  });

  it("uses the fallback project name for a job whose project is missing", () => {
    const orphan = job(J1, "00000000-0000-4000-8000-000000000000", NOW);
    const feed = deriveJobFeed([orphan], PROJECTS, NOW);
    expect((feed.items ?? [])[0]?.project_name).toBe(UNKNOWN_JOB_PROJECT_NAME);
  });

  it("scopes to one project and/or status and counts the whole feed before the limit page", () => {
    const scoped = deriveJobFeed(JOBS, PROJECTS, NOW, { projectId: P2 });
    expect(scoped.total).toBe(2);
    expect((scoped.items ?? []).map((item) => item.job_id)).toEqual([J2, J3]);

    const filtered = deriveJobFeed(JOBS, PROJECTS, NOW, { status: "running" });
    expect(filtered.total).toBe(1);
    expect((filtered.items ?? []).map((item) => item.job_id)).toEqual([J1]);

    const scopedAndFiltered = deriveJobFeed(JOBS, PROJECTS, NOW, {
      projectId: P2,
      status: "failed",
    });
    expect((scopedAndFiltered.items ?? []).map((item) => item.job_id)).toEqual([J3]);

    const empty = deriveJobFeed(JOBS, PROJECTS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });

    const paged = deriveJobFeed(JOBS, PROJECTS, NOW, { limit: 1 });
    expect(paged.total).toBe(3);
    expect((paged.items ?? []).map((item) => item.job_id)).toEqual([J2]);
  });
});

describe("job feed query helpers", () => {
  it("mirrors router validation for a malformed project id, status or limit", () => {
    expect(() => validateJobFeedArgs()).not.toThrow();
    expect(() =>
      validateJobFeedArgs({ projectId: P1, status: "queued", limit: 10 }),
    ).not.toThrow();
    for (const bad of [
      { projectId: "not-a-uuid" },
      { status: "paused" as unknown as JobStatus },
      { limit: 0 },
      { limit: 201 },
      { limit: 1.5 },
    ]) {
      try {
        validateJobFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the scope, filter and page onto the live query string", () => {
    expect(jobFeedQueryParams()).toEqual({
      project_id: undefined,
      status: undefined,
      limit: undefined,
    });
    expect(jobFeedQueryParams({ projectId: P1, status: "failed", limit: 5 })).toEqual({
      project_id: P1,
      status: "failed",
      limit: 5,
    });
  });
});
