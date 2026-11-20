import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { UNKNOWN_COMMENT_PROJECT_NAME } from "./commentFeed";
import type { Comment, Project } from "./types";
import {
  DEFAULT_COMMENT_OVERVIEW_RECENT_LIMIT,
  commentOverviewQueryParams,
  deriveCommentOverview,
  validateCommentOverviewArgs,
} from "./commentOverview";

const COMMENT_ID = "0b5c1e2a-6200-4000-8000-000000000001";
const PROJECT_ID = "0b5c1e2a-1000-4000-8000-000000000001";
const ASSET_ID = "0b5c1e2a-2000-4000-8000-000000000011";
const AUTHOR_A = "0b5c1e2a-0000-4000-8000-0000000000aa";
const AUTHOR_B = "0b5c1e2a-0000-4000-8000-0000000000bb";
const NOW = "2026-03-18T10:30:00.000Z";

function project(id: string, name: string): Project {
  return {
    id,
    org_id: "0b5c1e2a-0000-4000-8000-00000000000a",
    name,
    created_by: AUTHOR_A,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: COMMENT_ID,
    project_id: PROJECT_ID,
    asset_id: ASSET_ID,
    author_id: AUTHOR_A,
    body: "Lock the character silhouette before we expand the dataset.",
    created_at: "2026-03-17T10:30:00.000Z",
    ...overrides,
  };
}

describe("deriveCommentOverview", () => {
  it("derives identity, joined project, reference and whole-project/thread counts", () => {
    const overview = deriveCommentOverview(COMMENT_ID, {
      comments: [
        comment(),
        comment({
          id: "0b5c1e2a-6200-4000-8000-000000000002",
          author_id: AUTHOR_B,
          created_at: "2026-03-17T11:30:00.000Z",
        }),
        comment({
          id: "0b5c1e2a-6200-4000-8000-000000000003",
          asset_id: null,
          created_at: "2026-03-17T12:30:00.000Z",
        }),
        comment({
          id: "0b5c1e2a-6200-4000-8000-000000000004",
          project_id: "0b5c1e2a-1000-4000-8000-000000000002",
          created_at: "2026-03-17T13:30:00.000Z",
        }),
      ],
      projects: [project(PROJECT_ID, "Moonshot")],
      now: NOW,
    });

    expect(overview).toMatchObject({
      comment_id: COMMENT_ID,
      project_id: PROJECT_ID,
      project_name: "Moonshot",
      asset_id: ASSET_ID,
      author_id: AUTHOR_A,
      reference: "asset",
      counts: {
        project_comments: 3,
        project_authors: 2,
        project_assets: 1,
        thread_comments: 2,
      },
      generated_at: NOW,
    });
    // The sibling page holds only same-thread comments, newest first.
    expect(overview.recent_comments?.map((item) => item.comment_id)).toEqual([
      "0b5c1e2a-6200-4000-8000-000000000002",
      COMMENT_ID,
    ]);
    expect(overview.recent_comments?.[0]?.project_name).toBe("Moonshot");
  });

  it("marks project-level comments and uses the unknown-project fallback for orphans", () => {
    const overview = deriveCommentOverview(COMMENT_ID, {
      comments: [
        comment({ asset_id: null }),
        comment({ id: "0b5c1e2a-6200-4000-8000-000000000009", asset_id: null }),
      ],
      projects: [],
      now: NOW,
    });

    expect(overview.reference).toBe("project");
    expect(overview.project_name).toBe(UNKNOWN_COMMENT_PROJECT_NAME);
    expect(overview.counts.thread_comments).toBe(2);
    expect(overview.counts.project_assets).toBe(0);
    expect(overview.recent_comments?.[0]?.project_name).toBe(UNKNOWN_COMMENT_PROJECT_NAME);
  });

  it("bounds the sibling page by recentLimit without bounding the counts", () => {
    const comments = [COMMENT_ID, "0b5c1e2a-6200-4000-8000-000000000002", "0b5c1e2a-6200-4000-8000-000000000003"].map(
      (id, index) => comment({ id, created_at: `2026-03-17T1${index}:30:00.000Z` }),
    );
    const overview = deriveCommentOverview(
      COMMENT_ID,
      { comments, projects: [project(PROJECT_ID, "Moonshot")], now: NOW },
      { recentLimit: 1 },
    );

    expect(overview.recent_comments).toHaveLength(1);
    expect(overview.counts.thread_comments).toBe(3);
  });

  it("throws a 404 envelope for an unknown comment", () => {
    expect(() =>
      deriveCommentOverview("00000000-0000-4000-8000-000000000000", {
        comments: [],
        projects: [],
        now: NOW,
      }),
    ).toThrowError(ApiError);
    try {
      deriveCommentOverview("00000000-0000-4000-8000-000000000000", {
        comments: [],
        projects: [],
        now: NOW,
      });
    } catch (cause) {
      expect(cause).toMatchObject({ status: 404, code: "comment_not_found" });
    }
  });
});

describe("validateCommentOverviewArgs", () => {
  it("accepts a valid id and the default options", () => {
    expect(() => validateCommentOverviewArgs(COMMENT_ID)).not.toThrow();
    expect(() =>
      validateCommentOverviewArgs(COMMENT_ID, {
        recentLimit: DEFAULT_COMMENT_OVERVIEW_RECENT_LIMIT,
      }),
    ).not.toThrow();
  });

  it.each(["not-a-uuid", "oops"])("rejects a malformed comment id (%s)", (id) => {
    expect(() => validateCommentOverviewArgs(id)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it.each([0, 51, -1, 1.5])("rejects an out-of-range recentLimit (%s)", (recentLimit) => {
    expect(() => validateCommentOverviewArgs(COMMENT_ID, { recentLimit })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("commentOverviewQueryParams", () => {
  it("maps the recent limit to the live query param", () => {
    expect(commentOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(commentOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
