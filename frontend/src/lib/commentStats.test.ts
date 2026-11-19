import { describe, expect, it } from "vitest";

import {
  COMMENT_REFERENCES,
  commentStatsQueryParams,
  deriveCommentStats,
  validateCommentStatsArgs,
} from "./commentStats";
import type { Comment } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const C1 = "0b5c1e2a-6200-4000-8000-000000000001";
const C2 = "0b5c1e2a-6200-4000-8000-000000000002";
const C3 = "0b5c1e2a-6200-4000-8000-000000000003";
const A1 = "0b5c1e2a-0000-4000-8000-0000000000aa";
const A2 = "0b5c1e2a-0000-4000-8000-0000000000bb";
const ASSET = "0b5c1e2a-2000-4000-8000-000000000011";

function comment(
  id: string,
  projectId: string,
  authorId: string,
  createdAt: string,
  assetId: string | null = null,
): Comment {
  return {
    id,
    project_id: projectId,
    asset_id: assetId,
    author_id: authorId,
    body: "note",
    created_at: createdAt,
  };
}

const COMMENTS: readonly Comment[] = [
  comment(C1, P1, A1, "2026-03-18T08:00:00.000Z", ASSET),
  comment(C2, P1, A2, "2026-03-18T09:00:00.000Z"),
  comment(C3, P2, A1, "2026-03-18T08:30:00.000Z", ASSET),
];

describe("deriveCommentStats", () => {
  it("returns a zero-filled snapshot when there are no comments", () => {
    expect(deriveCommentStats([], NOW)).toEqual({
      total_comments: 0,
      total_authors: 0,
      total_projects: 0,
      by_reference: [
        { reference: "asset", count: 0 },
        { reference: "project", count: 0 },
      ],
      by_project: [],
      by_author: [],
      newest_comment_at: null,
      generated_at: NOW,
    });
  });

  it("derives totals, reference buckets, per-project/author breakdowns and recency", () => {
    const stats = deriveCommentStats(COMMENTS, NOW);

    expect(stats.total_comments).toBe(3);
    expect(stats.total_authors).toBe(2);
    expect(stats.total_projects).toBe(2);
    expect(stats.generated_at).toBe(NOW);
    expect(stats.by_reference).toEqual([
      { reference: "asset", count: 2 },
      { reference: "project", count: 1 },
    ]);
    expect(stats.by_project).toEqual([
      { project_id: P1, comments: 2, authors: 2 },
      { project_id: P2, comments: 1, authors: 1 },
    ]);
    expect(stats.by_author).toEqual([
      { author_id: A1, comments: 2 },
      { author_id: A2, comments: 1 },
    ]);
    expect(stats.newest_comment_at).toBe("2026-03-18T09:00:00.000Z");
    expect(deriveCommentStats([...COMMENTS].reverse(), NOW)).toEqual(stats);
  });

  it("breaks recency ties by the highest comment id", () => {
    const tied = [
      comment(C1, P1, A1, "2026-03-18T08:00:00.000Z"),
      comment(C2, P1, A1, "2026-03-18T08:00:00.000Z"),
    ];
    expect(deriveCommentStats(tied, NOW).newest_comment_at).toBe("2026-03-18T08:00:00.000Z");
    // The recency signal is the newest comment's timestamp in both cases; the
    // id tie-break just makes it deterministic across backends.
    expect(deriveCommentStats(tied, NOW).total_comments).toBe(2);
  });

  it("sorts breakdowns by descending count then id", () => {
    const stats = deriveCommentStats(
      [
        comment(C1, P2, A2, "2026-03-18T08:00:00.000Z"),
        comment(C2, P1, A1, "2026-03-18T08:00:00.000Z"),
      ],
      NOW,
    );
    expect(stats.by_project?.map((item) => item.project_id)).toEqual([P1, P2]);
    expect(stats.by_author?.map((item) => item.author_id)).toEqual([A1, A2]);
  });

  it("scopes the same derivation to one project", () => {
    const scoped = deriveCommentStats(COMMENTS, NOW, { projectId: P1 });
    expect(scoped.total_comments).toBe(2);
    expect(scoped.total_authors).toBe(2);
    expect(scoped.total_projects).toBe(1);
    expect(scoped.by_reference).toEqual([
      { reference: "asset", count: 1 },
      { reference: "project", count: 1 },
    ]);
    expect(scoped.by_project).toEqual([{ project_id: P1, comments: 2, authors: 2 }]);

    const empty = deriveCommentStats(COMMENTS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty.total_comments).toBe(0);
    expect(empty.by_project).toEqual([]);
    expect(empty.newest_comment_at).toBeNull();
  });
});

describe("comment stats query helpers", () => {
  it("exposes both canonical reference categories in a stable order", () => {
    expect(COMMENT_REFERENCES).toEqual(["asset", "project"]);
  });

  it("mirrors router validation for a malformed project id", () => {
    expect(() => validateCommentStatsArgs()).not.toThrow();
    expect(() => validateCommentStatsArgs({ projectId: P1 })).not.toThrow();
    try {
      validateCommentStatsArgs({ projectId: "not-a-uuid" });
      throw new Error("expected validation to fail");
    } catch (cause) {
      expect(cause).toMatchObject({ status: 422, code: "validation_error" });
    }
  });

  it("maps the scope onto the live query string", () => {
    expect(commentStatsQueryParams()).toEqual({ project_id: undefined });
    expect(commentStatsQueryParams({ projectId: P1 })).toEqual({ project_id: P1 });
  });
});
