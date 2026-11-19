import { describe, expect, it } from "vitest";

import type { Job, JobStatus } from "./types";
import {
  JOB_STATUSES,
  deriveJobStats,
  jobStatsQueryParams,
  validateJobStatsArgs,
} from "./jobStats";
import { JOBS, PROJECTS, REFERENCE_NOW } from "./mock/data";

const filmId = PROJECTS.find((project) => project.name.startsWith("Moonshot"))?.id ?? "";

function job(
  id: string,
  overrides: Partial<Job> = {},
): Job {
  return {
    id,
    project_id: filmId,
    operation_id: "lora-train",
    schema_version: "v1",
    status: "succeeded",
    created_by: "0b5c1e2a-0000-4000-8000-0000000000aa",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveJobStats", () => {
  it("zero-fills every lifecycle status in canonical order", () => {
    const stats = deriveJobStats([], REFERENCE_NOW);
    expect(stats.by_status).toEqual(JOB_STATUSES.map((status) => ({ status, count: 0 })));
  });

  it("derives an empty snapshot for empty seeds without error", () => {
    expect(deriveJobStats([], REFERENCE_NOW)).toEqual({
      total: 0,
      by_status: JOB_STATUSES.map((status) => ({ status, count: 0 })),
      by_operation: [],
      success_rate: 0.0,
      in_flight: 0,
      completed: 0,
      average_duration_seconds: null,
      generated_at: REFERENCE_NOW,
    });
  });

  it("counts status, operation outcomes and ordered per-operation totals", () => {
    const stats = deriveJobStats(
      [
        job("a", { operation_id: "zeta", status: "succeeded" }),
        job("b", { operation_id: "alpha", status: "succeeded" }),
        job("c", { operation_id: "alpha", status: "failed" }),
        job("d", { operation_id: "alpha", status: "failed" }),
        job("e", { operation_id: "zeta", status: "succeeded" }),
      ],
      REFERENCE_NOW,
    );
    // alpha (3) before zeta (2) by total; failures recorded per operation.
    expect(stats.by_operation).toEqual([
      { operation_id: "alpha", total: 3, succeeded: 1, failed: 2 },
      { operation_id: "zeta", total: 2, succeeded: 2, failed: 0 },
    ]);
    expect(stats.success_rate).toBeCloseTo(0.6, 3); // 3 succeeded / 5 terminal
    expect(stats.completed).toBe(5);
    expect(stats.in_flight).toBe(0);
  });

  it("excludes canceled and in-flight jobs from the success rate", () => {
    const stats = deriveJobStats(
      [
        job("a", { status: "succeeded" }),
        job("b", { status: "failed" }),
        job("c", { status: "canceled" }),
        job("d", { status: "queued" }),
        job("e", { status: "running" }),
      ],
      REFERENCE_NOW,
    );
    expect(stats.success_rate).toBe(0.5); // 1 succeeded / (1+1) terminal
    expect(stats.in_flight).toBe(2);
    expect(stats.completed).toBe(3); // succeeded + failed + canceled
  });

  it("averages wall-clock duration only over jobs with both endpoints", () => {
    const stats = deriveJobStats(
      [
        job("a", {
          status: "succeeded",
          started_at: "2026-01-01T00:00:00.000Z",
          finished_at: "2026-01-01T00:01:00.000Z",
        }),
        job("b", {
          status: "failed",
          started_at: "2026-01-01T00:00:00.000Z",
          finished_at: "2026-01-01T00:03:00.000Z",
        }),
        job("c", { status: "running", started_at: "2026-01-01T00:00:00.000Z" }),
      ],
      REFERENCE_NOW,
    );
    // (60s + 180s) / 2 = 120s; job "c" has no finish and is excluded.
    expect(stats.average_duration_seconds).toBe(120);
  });

  it("leaves the average null when no completed job has timing", () => {
    const stats = deriveJobStats(
      [job("a", { status: "queued", started_at: undefined, finished_at: undefined })],
      REFERENCE_NOW,
    );
    expect(stats.average_duration_seconds).toBeNull();
  });

  it("mirrors the backend snapshot over the authoritative seeds", () => {
    const stats = deriveJobStats(JOBS, REFERENCE_NOW);
    expect(stats.total).toBe(JOBS.length);
    expect(stats.generated_at).toBe(REFERENCE_NOW);
    expect((stats.by_status ?? []).reduce((sum, entry) => sum + entry.count, 0)).toBe(JOBS.length);
    expect((stats.by_operation ?? []).reduce((sum, entry) => sum + entry.total, 0)).toBe(
      JOBS.length,
    );
  });

  it("scopes the derivation to one project", () => {
    const scoped = deriveJobStats(JOBS, REFERENCE_NOW, { projectId: filmId });
    expect(scoped.total).toBe(JOBS.filter((candidate) => candidate.project_id === filmId).length);
    expect(derivedStatuses(scoped.by_status ?? [])).toEqual(
      expectedStatuses(JOBS.filter((candidate) => candidate.project_id === filmId)),
    );
  });
});

function derivedStatuses(byStatus: ReadonlyArray<{ status: JobStatus; count: number }>) {
  return Object.fromEntries(byStatus.map((entry) => [entry.status, entry.count]));
}

function expectedStatuses(jobs: readonly Job[]) {
  const counts: Record<string, number> = {};
  for (const status of JOB_STATUSES) counts[status] = 0;
  for (const job of jobs) counts[job.status] = (counts[job.status] ?? 0) + 1;
  return counts;
}

describe("validateJobStatsArgs", () => {
  it("rejects a malformed project id with a 422 envelope", () => {
    expect(() => validateJobStatsArgs({ projectId: "not-a-uuid" })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "project_id" })],
      }),
    );
  });

  it("accepts a valid uuid or an omitted scope", () => {
    expect(() => validateJobStatsArgs()).not.toThrow();
    expect(() => validateJobStatsArgs({ projectId: filmId })).not.toThrow();
  });
});

describe("jobStatsQueryParams", () => {
  it("maps the project scope to the authoritative query string", () => {
    expect(jobStatsQueryParams()).toEqual({ project_id: undefined });
    expect(jobStatsQueryParams({ projectId: "p1" })).toEqual({ project_id: "p1" });
  });
});
