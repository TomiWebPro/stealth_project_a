import { describe, expect, it } from "vitest";

import type { Job } from "./types";
import {
  deriveJobQueue,
  jobQueueQueryParams,
  validateJobQueueArgs,
} from "./jobQueue";
import { JOBS, PROJECTS, REFERENCE_NOW } from "./mock/data";

const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";
const emptyId = PROJECTS.find((project) => project.name.startsWith("Blank Slate"))?.id ?? "";

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    project_id: filmId,
    operation_id: "dataset-prep",
    schema_version: "v1",
    status: "queued",
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveJobQueue", () => {
  it("yields a zero-filled empty view for no active jobs", () => {
    expect(deriveJobQueue([], REFERENCE_NOW)).toEqual({
      total: 0,
      waiting: 0,
      running: 0,
      entries: [],
      generated_at: REFERENCE_NOW,
    });
  });

  it("excludes terminal jobs and counts the whole queue before paging", () => {
    const view = deriveJobQueue(
      [
        job("a", { status: "succeeded" }),
        job("b", { status: "failed" }),
        job("c", { status: "canceled" }),
        job("d", { status: "queued" }),
        job("e", { status: "running" }),
      ],
      REFERENCE_NOW,
    );
    expect(view.total).toBe(2);
    expect(view.waiting).toBe(1);
    expect(view.running).toBe(1);
    expect((view.entries ?? []).map((entry) => entry.job_id)).toEqual(["d", "e"]);
  });

  it("orders FIFO by created_at then job id with 1-based positions", () => {
    const view = deriveJobQueue(
      [
        job("b", { created_at: "2026-01-01T00:00:00.000Z" }),
        job("a", { created_at: "2026-01-01T00:00:00.000Z" }),
        job("c", { created_at: "2026-01-02T00:00:00.000Z", status: "running" }),
      ],
      REFERENCE_NOW,
    );
    expect((view.entries ?? []).map((entry) => [entry.position, entry.job_id])).toEqual([
      [1, "a"],
      [2, "b"],
      [3, "c"],
    ]);
    expect((view.entries ?? [])[0]).toMatchObject({
      operation_id: "dataset-prep",
      status: "queued",
      project_id: filmId,
    });
  });

  it("bounds the returned page while counters cover the full queue", () => {
    const view = deriveJobQueue(
      [
        job("a", { created_at: "2026-01-01T00:00:00.000Z" }),
        job("b", { created_at: "2026-01-02T00:00:00.000Z" }),
        job("c", { created_at: "2026-01-03T00:00:00.000Z" }),
      ],
      REFERENCE_NOW,
      { limit: 2 },
    );
    expect(view.total).toBe(3);
    expect((view.entries ?? []).map((entry) => entry.job_id)).toEqual(["a", "b"]);
  });

  it("scopes to one project and mirrors the backend over the authoritative seeds", () => {
    const scoped = deriveJobQueue(JOBS, REFERENCE_NOW, { projectId: filmId });
    const expected = JOBS.filter(
      (candidate) =>
        candidate.project_id === filmId &&
        (candidate.status === "queued" || candidate.status === "running"),
    );
    expect(scoped.total).toBe(expected.length);
    expect(scoped.waiting + scoped.running).toBe(expected.length);
    expect(scoped.entries).toHaveLength(expected.length);
    expect(scoped.generated_at).toBe(REFERENCE_NOW);

    const empty = deriveJobQueue(JOBS, REFERENCE_NOW, { projectId: emptyId });
    expect(empty).toMatchObject({ total: 0, waiting: 0, running: 0, entries: [] });
  });
});

describe("validateJobQueueArgs", () => {
  it("rejects a malformed project id and an out-of-range limit with 422 envelopes", () => {
    expect(() => validateJobQueueArgs({ projectId: "not-a-uuid" })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "project_id" })],
      }),
    );
    for (const limit of [0, 201, 1.5]) {
      expect(() => validateJobQueueArgs({ limit })).toThrowError(
        expect.objectContaining({
          status: 422,
          code: "validation_error",
          details: [expect.objectContaining({ field: "limit" })],
        }),
      );
    }
  });

  it("accepts an omitted scope, a valid uuid and boundary limits", () => {
    expect(() => validateJobQueueArgs()).not.toThrow();
    expect(() => validateJobQueueArgs({ projectId: filmId, limit: 1 })).not.toThrow();
    expect(() => validateJobQueueArgs({ projectId: filmId, limit: 200 })).not.toThrow();
  });
});

describe("jobQueueQueryParams", () => {
  it("maps the project scope and page size to the authoritative query string", () => {
    expect(jobQueueQueryParams()).toEqual({ project_id: undefined, limit: undefined });
    expect(jobQueueQueryParams({ projectId: "p1", limit: 10 })).toEqual({
      project_id: "p1",
      limit: 10,
    });
  });
});
