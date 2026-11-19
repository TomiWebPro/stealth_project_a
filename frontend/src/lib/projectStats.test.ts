import { describe, expect, it } from "vitest";

import type { Asset, Conversation, Job, Project } from "./types";
import {
  PROJECT_LIFECYCLES,
  deriveProjectStats,
  projectStatsQueryParams,
  validateProjectStatsArgs,
} from "./projectStats";
import { REFERENCE_NOW } from "./mock/data";

const ORG_A = "0b5c1e2a-0000-4000-8000-00000000000a";
const ORG_B = "0b5c1e2a-0000-4000-8000-00000000000b";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";

function project(
  id: string,
  overrides: Partial<Project> = {},
): Project {
  return {
    id,
    org_id: ORG_A,
    name: `project-${id}`,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function asset(id: string, projectId: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    project_id: projectId,
    type: "image",
    name: `asset-${id}`,
    status: "ready",
    creator_id: CREATOR,
    storage: { key: `assets/${id}`, size_bytes: 100, content_type: "image/png" },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function conversation(id: string, projectId: string): Conversation {
  return {
    id,
    project_id: projectId,
    title: `conversation-${id}`,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function job(id: string, projectId: string): Job {
  return {
    id,
    project_id: projectId,
    operation_id: "text-to-image",
    schema_version: "1.0.0",
    status: "queued",
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("deriveProjectStats", () => {
  it("zero-fills every lifecycle and yields null recency for an empty store", () => {
    const stats = deriveProjectStats([], [], [], [], REFERENCE_NOW);
    expect(stats).toEqual({
      total: 0,
      by_lifecycle: PROJECT_LIFECYCLES.map((lifecycle) => ({ lifecycle, count: 0 })),
      active: 0,
      archived: 0,
      total_assets: 0,
      total_conversations: 0,
      total_jobs: 0,
      average_assets_per_project: 0.0,
      average_jobs_per_project: 0.0,
      newest_project_at: null,
      generated_at: REFERENCE_NOW,
    });
  });

  it("derives lifecycle counts, cross-domain totals, averages and recency", () => {
    const p1 = project("p1", { name: "Active", created_at: "2026-01-01T00:00:00.000Z" });
    const p2 = project("p2", {
      name: "Archived",
      archived: true,
      created_at: "2026-01-03T00:00:00.000Z",
    });
    const stats = deriveProjectStats(
      [p1, p2],
      [
        asset("a1", "p1"),
        asset("a2", "p1"),
        asset("a3", "p1", { status: "deleted" }),
        asset("a4", "p2"),
      ],
      [conversation("c1", "p1"), conversation("c2", "p1"), conversation("c3", "p2")],
      [job("j1", "p1"), job("j2", "p1"), job("j3", "p1"), job("j4", "p2")],
      REFERENCE_NOW,
    );

    expect(stats.total).toBe(2);
    expect(stats.active).toBe(1);
    expect(stats.archived).toBe(1);
    expect(stats.by_lifecycle).toEqual([
      { lifecycle: "active", count: 1 },
      { lifecycle: "archived", count: 1 },
    ]);
    expect(stats.total_assets).toBe(3);
    expect(stats.total_conversations).toBe(3);
    expect(stats.total_jobs).toBe(4);
    expect(stats.average_assets_per_project).toBe(1.5);
    expect(stats.average_jobs_per_project).toBe(2.0);
    expect(stats.newest_project_at).toBe("2026-01-03T00:00:00.000Z");
  });

  it("excludes soft-deleted assets from every metric", () => {
    const stats = deriveProjectStats(
      [project("p1")],
      [asset("a1", "p1"), asset("a2", "p1", { status: "deleted" })],
      [],
      [],
      REFERENCE_NOW,
    );
    expect(stats.total_assets).toBe(1);
    expect(stats.average_assets_per_project).toBe(1.0);
  });

  it("breaks recency ties by project id like the backend max key", () => {
    const stats = deriveProjectStats(
      [
        project("a", { created_at: "2026-01-02T00:00:00.000Z" }),
        project("b", { created_at: "2026-01-02T00:00:00.000Z" }),
      ],
      [],
      [],
      [],
      REFERENCE_NOW,
    );
    expect(stats.newest_project_at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("scopes projects and their domain documents to one organization", () => {
    const projects = [
      project("a1", { org_id: ORG_A }),
      project("a2", { org_id: ORG_A, archived: true }),
      project("b1", { org_id: ORG_B }),
    ];
    const assets = [
      asset("x1", "a1"),
      asset("x2", "a2"),
      asset("x3", "b1"),
      asset("x4", "b1"),
    ];
    const conversations = [conversation("d1", "a1")];
    const jobs = [job("k1", "b1")];

    const scoped = deriveProjectStats(
      projects,
      assets,
      conversations,
      jobs,
      REFERENCE_NOW,
      { orgId: ORG_A },
    );
    expect(scoped.total).toBe(2);
    expect(scoped.active).toBe(1);
    expect(scoped.archived).toBe(1);
    expect(scoped.total_assets).toBe(2);
    expect(scoped.total_conversations).toBe(1);
    expect(scoped.total_jobs).toBe(0);
    expect(scoped.average_assets_per_project).toBe(1.0);
    expect(scoped.average_jobs_per_project).toBe(0.0);

    const other = deriveProjectStats(projects, assets, conversations, jobs, REFERENCE_NOW, {
      orgId: ORG_B,
    });
    expect(other.total).toBe(1);
    expect(other.total_assets).toBe(2);
    expect(other.total_jobs).toBe(1);

    const all = deriveProjectStats(projects, assets, conversations, jobs, REFERENCE_NOW);
    expect(all.total).toBe(3);
    expect(all.total_assets).toBe(4);
    expect(all.total_jobs).toBe(1);
  });

  it("yields a zero-filled snapshot for an unknown (well-formed) org", () => {
    const stats = deriveProjectStats(
      [project("p1", { org_id: ORG_A })],
      [asset("a1", "p1")],
      [],
      [],
      REFERENCE_NOW,
      { orgId: "00000000-0000-4000-8000-000000000000" },
    );
    expect(stats.total).toBe(0);
    expect(stats.by_lifecycle).toEqual(PROJECT_LIFECYCLES.map((lifecycle) => ({ lifecycle, count: 0 })));
    expect(stats.newest_project_at).toBeNull();
  });
});

describe("validateProjectStatsArgs", () => {
  it("rejects a malformed org id with a 422 envelope", () => {
    expect(() => validateProjectStatsArgs({ orgId: "not-a-uuid" })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "org_id" })],
      }),
    );
  });

  it("accepts a valid uuid or an omitted scope", () => {
    expect(() => validateProjectStatsArgs()).not.toThrow();
    expect(() => validateProjectStatsArgs({ orgId: ORG_A })).not.toThrow();
  });
});

describe("projectStatsQueryParams", () => {
  it("maps the org scope to the authoritative query string", () => {
    expect(projectStatsQueryParams()).toEqual({ org_id: undefined });
    expect(projectStatsQueryParams({ orgId: ORG_A })).toEqual({ org_id: ORG_A });
  });
});
