import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { REFERENCE_NOW } from "./mock/data";
import type { Asset, Comment, Conversation, Job, Presence, Project } from "./types";
import type { AssetVersionRecord } from "./versionStats";
import {
  DEFAULT_OVERVIEW_RECENT_LIMIT,
  deriveProjectOverview,
  projectOverviewQueryParams,
  validateProjectOverviewArgs,
} from "./projectOverview";
import type { ProjectOverviewSeeds } from "./projectOverview";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";

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

function job(id: string, projectId: string, createdAt: string): Job {
  return {
    id,
    project_id: projectId,
    operation_id: "text-to-image",
    schema_version: "1.0.0",
    status: "queued",
    created_by: CREATOR,
    created_at: createdAt,
  };
}

function comment(id: string, projectId: string, authorId: string): Comment {
  return {
    id,
    project_id: projectId,
    author_id: authorId,
    body: `comment-${id}`,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function presence(userId: string, projectId: string): Presence {
  return {
    user_id: userId,
    project_id: projectId,
    state: "online",
    last_seen_at: "2026-01-01T00:00:00.000Z",
  };
}

const receipt = (version = 1): Record<string, unknown> => ({
  version,
  size_bytes: 100,
  published_at: "2026-01-02T00:00:00.000Z",
  comment: "ok",
  publisher: CREATOR,
});

function seeds(overrides: Partial<ProjectOverviewSeeds> = {}): ProjectOverviewSeeds {
  return {
    projects: [project(PROJECT_A)],
    assets: [],
    assetVersions: [],
    conversations: [],
    jobs: [],
    comments: [],
    presence: [],
    now: REFERENCE_NOW,
    ...overrides,
  };
}

describe("deriveProjectOverview", () => {
  it("zero-fills counts and recent lists for a project with no data", () => {
    const overview = deriveProjectOverview(PROJECT_A, seeds());
    expect(overview).toEqual({
      project_id: PROJECT_A,
      project_name: `project-${PROJECT_A}`,
      lifecycle: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      counts: {
        assets: 0,
        conversations: 0,
        jobs: 0,
        comments: 0,
        publishes: 0,
        versions: 0,
        collaborators: 0,
      },
      recent_jobs: [],
      recent_assets: [],
      generated_at: REFERENCE_NOW,
    });
  });

  it("derives cross-domain counts, distinct collaborators and the active/archived lifecycle", () => {
    const archived = project(PROJECT_A, { name: "Archived film", archived: true });
    const overview = deriveProjectOverview(
      PROJECT_A,
      seeds({
        projects: [archived],
        assets: [asset("a1", PROJECT_A), asset("a2", PROJECT_A)],
        conversations: [conversation("c1", PROJECT_A), conversation("c2", PROJECT_A)],
        jobs: [job("j1", PROJECT_A, "2026-01-01T00:00:00.000Z")],
        comments: [comment("m1", PROJECT_A, "u1"), comment("m2", PROJECT_A, "u2")],
        presence: [presence("u1", PROJECT_A), presence("u2", PROJECT_A), presence("u1", PROJECT_A)],
      }),
    );
    expect(overview.lifecycle).toBe("archived");
    expect(overview.project_name).toBe("Archived film");
    expect(overview.counts).toEqual({
      assets: 2,
      conversations: 2,
      jobs: 1,
      comments: 2,
      publishes: 0,
      versions: 0,
      collaborators: 2, // distinct presence users
    });
  });

  it("excludes soft-deleted assets and their versions, and counts well-formed receipts only", () => {
    const versions: AssetVersionRecord[] = [
      { asset_id: "a1", version: 1, created_at: "2026-01-01T00:00:00.000Z" },
      { asset_id: "a1", version: 2, created_at: "2026-01-02T00:00:00.000Z" },
      { asset_id: "a3", version: 1, created_at: "2026-01-01T00:00:00.000Z" }, // deleted asset
    ];
    const overview = deriveProjectOverview(
      PROJECT_A,
      seeds({
        assets: [
          asset("a1", PROJECT_A, { metadata: { publish_receipt: receipt(1) } }),
          asset("a2", PROJECT_A, { metadata: { publish_receipt: receipt(2) } }),
          asset("a3", PROJECT_A, { status: "deleted", metadata: { publish_receipt: receipt(1) } }),
          asset("a4", PROJECT_A, { metadata: { publish_receipt: { version: "bad" } } }),
        ],
        assetVersions: versions,
      }),
    );
    expect(overview.counts.assets).toBe(3); // deleted excluded
    expect(overview.counts.publishes).toBe(2); // only well-formed receipts
    expect(overview.counts.versions).toBe(2); // versions of the deleted asset excluded
    expect(overview.recent_assets?.some((item) => item.id === "a3")).toBe(false);
  });

  it("returns bullets newest-first by (created_at, id) and bounds them by recentLimit", () => {
    const otherProject = "22222222-2222-4222-8222-222222222222";
    const overview = deriveProjectOverview(
      PROJECT_A,
      seeds({
        projects: [project(PROJECT_A), project(otherProject)],
        jobs: [
          job("j2", PROJECT_A, "2026-01-03T00:00:00.000Z"),
          job("j1", PROJECT_A, "2026-01-02T00:00:00.000Z"),
          job("j0", PROJECT_A, "2026-01-01T00:00:00.000Z"),
          job("other", otherProject, "2026-01-09T00:00:00.000Z"),
        ],
        assets: [
          asset("a2", PROJECT_A, { created_at: "2026-01-03T00:00:00.000Z" }),
          asset("a1", PROJECT_A, { created_at: "2026-01-02T00:00:00.000Z" }),
        ],
      }),
      { recentLimit: 2 },
    );
    expect(overview.recent_jobs?.map((item) => item.id)).toEqual(["j2", "j1"]);
    expect(overview.recent_assets?.map((item) => item.id)).toEqual(["a2", "a1"]);
    expect(overview.counts.jobs).toBe(3); // total counts whole project, not the page
  });

  it("defaults the recent limit to five", () => {
    const jobs = Array.from({ length: 7 }, (_, index) =>
      job(`j${index}`, PROJECT_A, `2026-01-0${index + 1}T00:00:00.000Z`),
    );
    const overview = deriveProjectOverview(PROJECT_A, seeds({ jobs }));
    expect(overview.recent_jobs).toHaveLength(DEFAULT_OVERVIEW_RECENT_LIMIT);
  });

  it("rejects an unknown project with a 404", () => {
    expect(() => deriveProjectOverview(PROJECT_A, seeds({ projects: [] }))).toThrow(
      expect.objectContaining({ status: 404, code: "not_found" }),
    );
  });
});

describe("validateProjectOverviewArgs", () => {
  it("accepts a well-formed id and an in-range recent limit", () => {
    expect(() => validateProjectOverviewArgs(PROJECT_A, { recentLimit: 50 })).not.toThrow();
    expect(() => validateProjectOverviewArgs(PROJECT_A)).not.toThrow();
  });

  it("mirrors the router 422 envelope for a malformed id or out-of-range limit", () => {
    for (const bad of [
      () => validateProjectOverviewArgs("not-a-uuid"),
      () => validateProjectOverviewArgs(PROJECT_A, { recentLimit: 0 }),
      () => validateProjectOverviewArgs(PROJECT_A, { recentLimit: 51 }),
    ]) {
      try {
        bad();
        throw new Error("expected a validation error");
      } catch (cause) {
        expect(cause).toBeInstanceOf(ApiError);
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });
});

describe("projectOverviewQueryParams", () => {
  it("maps the recent limit to the wire query parameter", () => {
    expect(projectOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(projectOverviewQueryParams({ recentLimit: 3 })).toEqual({ recent_limit: 3 });
  });
});
