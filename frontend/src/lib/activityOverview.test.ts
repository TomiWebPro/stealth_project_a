import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { ActivityKind, Asset, Comment, Job, Project } from "./types";
import {
  DEFAULT_ACTIVITY_OVERVIEW_RECENT_LIMIT,
  UNKNOWN_ACTIVITY_OVERVIEW_PROJECT_NAME,
  activityOverviewQueryParams,
  deriveActivityOverview,
  validateActivityOverviewArgs,
} from "./activityOverview";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const A1 = "0b5c1e2a-2000-4000-8000-000000000011";
const A2 = "0b5c1e2a-2000-4000-8000-000000000012";
const J1 = "0b5c1e2a-3000-4000-8000-000000000001";
const C1 = "0b5c1e2a-6000-4000-8000-000000000001";
const ACTOR_A = "0b5c1e2a-0000-4000-8000-0000000000aa";
const ACTOR_B = "0b5c1e2a-0000-4000-8000-0000000000bb";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: ACTOR_A, created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: ACTOR_A, created_at: NOW, updated_at: NOW },
];

function asset(id: string, projectId: string, createdAt: string): Asset {
  return {
    id,
    project_id: projectId,
    type: "image",
    name: `asset-${id.slice(-4)}`,
    creator_id: ACTOR_A,
    storage: { key: `Output/${id}`, size_bytes: 1, content_type: "image/png" },
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function job(id: string, projectId: string, createdAt: string): Job {
  return {
    id,
    project_id: projectId,
    operation_id: "dataset-prep",
    schema_version: "v1",
    status: "running",
    attempt: 1,
    created_by: ACTOR_A,
    created_at: createdAt,
  };
}

function comment(id: string, projectId: string, createdAt: string): Comment {
  return {
    id,
    project_id: projectId,
    author_id: ACTOR_B,
    body: "Looks good",
    created_at: createdAt,
  };
}

const ASSETS: readonly Asset[] = [
  asset(A1, P1, "2026-03-18T08:00:00.000Z"),
  asset(A2, P2, "2026-03-18T07:00:00.000Z"),
];
const JOBS: readonly Job[] = [job(J1, P1, "2026-03-18T09:00:00.000Z")];
const COMMENTS: readonly Comment[] = [comment(C1, P1, "2026-03-18T09:30:00.000Z")];

const SEEDS = { assets: ASSETS, jobs: JOBS, comments: COMMENTS, projects: PROJECTS, now: NOW };
const TARGET = `asset-${A1}`;

describe("deriveActivityOverview", () => {
  it("derives identity, joined project, project-scoped counts and newest-first siblings", () => {
    const overview = deriveActivityOverview(TARGET, SEEDS);

    expect(overview).toMatchObject({
      id: TARGET,
      kind: "asset",
      project_id: P1,
      project_name: "Moonshot",
      actor_id: ACTOR_A,
      timestamp: "2026-03-18T08:00:00.000Z",
      tone: "info",
      counts: {
        total_events: 3,
        total_participants: 2,
        workspace_events: 4,
      },
      generated_at: NOW,
    });
    // Zero-filled over the canonical kinds, scoped to the viewed event's project.
    expect(overview.counts.by_kind).toEqual([
      { kind: "asset", count: 1 },
      { kind: "publish", count: 0 },
      { kind: "job", count: 1 },
      { kind: "comment", count: 1 },
    ] as Array<{ kind: ActivityKind; count: number }>);
    // Siblings are same-project (P2's asset is excluded), newest-first.
    expect(overview.recent_events?.map((event) => event.id)).toEqual([
      `comment-${C1}`,
      `job-${J1}`,
      TARGET,
    ]);
  });

  it("bounds the sibling page by recentLimit without bounding the counts", () => {
    const overview = deriveActivityOverview(TARGET, SEEDS, { recentLimit: 1 });

    expect(overview.recent_events).toHaveLength(1);
    expect(overview.recent_events?.[0]?.id).toBe(`comment-${C1}`);
    expect(overview.counts).toEqual(deriveActivityOverview(TARGET, SEEDS).counts);
  });

  it("uses the unknown-project fallback for an orphan project", () => {
    const orphan = asset(A1, "00000000-0000-4000-8000-000000000000", "2026-03-18T08:00:00.000Z");
    const overview = deriveActivityOverview(TARGET, {
      ...SEEDS,
      assets: [orphan],
      jobs: [],
      comments: [],
    });

    expect(overview.project_name).toBe(UNKNOWN_ACTIVITY_OVERVIEW_PROJECT_NAME);
    expect(overview.recent_events?.[0]?.project_id).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("throws an activity_not_found 404 for a well-formed id with no live event", () => {
    try {
      deriveActivityOverview(`asset-00000000-0000-4000-8000-000000000000`, SEEDS);
      throw new Error("expected derivation to fail");
    } catch (cause) {
      expect(cause).toBeInstanceOf(ApiError);
      expect(cause).toMatchObject({ status: 404, code: "activity_not_found" });
    }
  });
});

describe("validateActivityOverviewArgs", () => {
  it("accepts a well-formed id and default options", () => {
    expect(() => validateActivityOverviewArgs(TARGET)).not.toThrow();
    expect(() =>
      validateActivityOverviewArgs(TARGET, { recentLimit: DEFAULT_ACTIVITY_OVERVIEW_RECENT_LIMIT }),
    ).not.toThrow();
  });

  it.each(["not-a-uuid", `bogus-${A1}`, `asset-not-a-uuid`, "asset-", "asset"])(
    "rejects a malformed event id (%s)",
    (eventId) => {
      expect(() => validateActivityOverviewArgs(eventId)).toThrowError(
        expect.objectContaining({ status: 422, code: "validation_error" }),
      );
    },
  );

  it.each([0, 51, -1, 1.5])("rejects an out-of-range recentLimit (%s)", (recentLimit) => {
    expect(() => validateActivityOverviewArgs(TARGET, { recentLimit })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("activityOverviewQueryParams", () => {
  it("maps the recent limit to the live query param", () => {
    expect(activityOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(activityOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
