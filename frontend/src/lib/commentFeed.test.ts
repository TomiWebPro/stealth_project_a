import { describe, expect, it } from "vitest";

import {
  commentFeedQueryParams,
  deriveCommentFeed,
  UNKNOWN_COMMENT_PROJECT_NAME,
  validateCommentFeedArgs,
} from "./commentFeed";
import type { Comment, Project } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const C1 = "0b5c1e2a-6200-4000-8000-000000000001";
const C2 = "0b5c1e2a-6200-4000-8000-000000000002";
const C3 = "0b5c1e2a-6200-4000-8000-000000000003";
const ASSET = "0b5c1e2a-2000-4000-8000-000000000011";

const PROJECTS: readonly Project[] = [
  { id: P1, name: "Moonshot", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
  { id: P2, name: "Brand Film", org_id: "org", created_by: "user", created_at: NOW, updated_at: NOW },
];

function comment(
  id: string,
  projectId: string,
  createdAt: string,
  body: string,
  assetId: string | null = null,
): Comment {
  return {
    id,
    project_id: projectId,
    asset_id: assetId,
    author_id: "0b5c1e2a-0000-4000-8000-0000000000bb",
    body,
    created_at: createdAt,
  };
}

const COMMENTS: readonly Comment[] = [
  comment(C1, P1, "2026-03-18T08:00:00.000Z", "Lock the silhouette.", ASSET),
  comment(C2, P2, "2026-03-18T09:00:00.000Z", "Publish approved."),
  comment(C3, P2, "2026-03-18T08:00:00.000Z", "Checking inputs."),
];

describe("deriveCommentFeed", () => {
  it("returns an empty feed when there are no comments", () => {
    expect(deriveCommentFeed([], PROJECTS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with a comment-id tie-break and joins project names", () => {
    const feed = deriveCommentFeed([...COMMENTS].reverse(), PROJECTS, NOW);

    expect(feed.total).toBe(3);
    expect(feed.generated_at).toBe(NOW);
    expect((feed.items ?? []).map((item) => item.comment_id)).toEqual([C2, C3, C1]);
    expect((feed.items ?? [])[0]).toMatchObject({
      comment_id: C2,
      project_id: P2,
      project_name: "Brand Film",
      asset_id: null,
      author_id: "0b5c1e2a-0000-4000-8000-0000000000bb",
      body: "Publish approved.",
      created_at: "2026-03-18T09:00:00.000Z",
    });
    expect((feed.items ?? [])[2]?.asset_id).toBe(ASSET);
    expect(deriveCommentFeed(COMMENTS, PROJECTS, NOW)).toEqual(feed);
  });

  it("breaks created-at ties by descending comment id", () => {
    const tied = [
      comment(C1, P1, "2026-03-18T08:00:00.000Z", "one"),
      comment(C3, P1, "2026-03-18T08:00:00.000Z", "two"),
    ];
    expect(
      deriveCommentFeed(tied, PROJECTS, NOW).items?.map((item) => item.comment_id),
    ).toEqual([C3, C1]);
  });

  it("uses the fallback project name for a comment whose project is missing", () => {
    const orphan = comment(C1, "00000000-0000-4000-8000-000000000000", NOW, "orphan");
    const feed = deriveCommentFeed([orphan], PROJECTS, NOW);
    expect((feed.items ?? [])[0]?.project_name).toBe(UNKNOWN_COMMENT_PROJECT_NAME);
  });

  it("scopes to one project and counts the whole feed before the limit page", () => {
    const scoped = deriveCommentFeed(COMMENTS, PROJECTS, NOW, { projectId: P2 });
    expect(scoped.total).toBe(2);
    expect((scoped.items ?? []).map((item) => item.comment_id)).toEqual([C2, C3]);

    const empty = deriveCommentFeed(COMMENTS, PROJECTS, NOW, {
      projectId: "00000000-0000-4000-8000-000000000000",
    });
    expect(empty).toEqual({ items: [], total: 0, generated_at: NOW });

    const paged = deriveCommentFeed(COMMENTS, PROJECTS, NOW, { limit: 2 });
    expect(paged.total).toBe(3);
    expect((paged.items ?? []).map((item) => item.comment_id)).toEqual([C2, C3]);
  });
});

describe("comment feed query helpers", () => {
  it("mirrors router validation for a malformed project id or limit", () => {
    expect(() => validateCommentFeedArgs()).not.toThrow();
    expect(() => validateCommentFeedArgs({ projectId: P1, limit: 10 })).not.toThrow();
    for (const bad of [{ projectId: "not-a-uuid" }, { limit: 0 }, { limit: 201 }, { limit: 1.5 }]) {
      try {
        validateCommentFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the scope and page onto the live query string", () => {
    expect(commentFeedQueryParams()).toEqual({ project_id: undefined, limit: undefined });
    expect(commentFeedQueryParams({ projectId: P1, limit: 5 })).toEqual({
      project_id: P1,
      limit: 5,
    });
  });
});
