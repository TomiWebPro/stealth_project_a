import { describe, expect, it } from "vitest";
import type { CommentFeed, CommentFeedItem } from "../../lib/types";
import {
  COMMENT_FEED_LIMITS,
  buildCommentFeedOptions,
  commentBodyPreview,
  commentFeedEmptyDescription,
  commentFeedGeneratedAtLabel,
  commentFeedRows,
  commentFeedSummary,
  shortIdLabel,
} from "./commentFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const assetComment: CommentFeedItem = {
  comment_id: "comment-bbbb-1111",
  project_id: "proj-aaaa-2222",
  project_name: "A Short Film",
  asset_id: "asset-cccc-3333",
  author_id: "user-dddd-4444",
  body: "  Ready for the  first  review pass.  ",
  created_at: "2026-01-01T00:45:00Z",
};

const plainComment: CommentFeedItem = {
  comment_id: "comment-aaaa-5555",
  project_id: "proj-eeee-6666",
  project_name: "Unknown project",
  asset_id: null,
  author_id: "user-ffff-7777",
  body: "Blocked on the plate.",
  created_at: "2026-01-01T00:30:00Z",
};

const populated: CommentFeed = {
  items: [assetComment, plainComment],
  total: 9,
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: CommentFeed = { items: [], total: 0, generated_at: "2026-01-01T00:00:00Z" };

describe("comment feed display helpers", () => {
  it("builds hook options with an optional project scope and bounded page size", () => {
    expect(buildCommentFeedOptions(undefined, 25)).toEqual({ limit: 25 });
    expect(buildCommentFeedOptions("proj-aaaa-2222", 10)).toEqual({
      projectId: "proj-aaaa-2222",
      limit: 10,
    });
    expect(COMMENT_FEED_LIMITS).toEqual([10, 25, 50]);
  });

  it("maps a canonical feed to render-ready rows in wire order", () => {
    const rows = commentFeedRows(populated, NOW);
    expect(rows.map((row) => row.id)).toEqual(["comment-bbbb-1111", "comment-aaaa-5555"]);
    expect(rows[0]).toMatchObject({
      commentId: "comment-bbbb-1111",
      projectId: "proj-aaaa-2222",
      projectName: "A Short Film",
      assetId: "asset-cccc-3333",
      hasAsset: true,
      assetLabel: "Asset asset-cc…",
      authorId: "user-dddd-4444",
      authorLabel: "Author user-ddd…",
      authorTone: "info",
      body: "  Ready for the  first  review pass.  ",
      bodyPreview: "Ready for the first review pass.",
      relativeTime: "15 minutes ago",
      timestamp: "2026-01-01T00:45:00Z",
    });
    expect(rows[1]).toMatchObject({
      projectName: "Unknown project",
      assetId: null,
      hasAsset: false,
      assetLabel: "",
      bodyPreview: "Blocked on the plate.",
      relativeTime: "30 minutes ago",
    });
  });

  it("returns no rows for a missing or empty feed", () => {
    expect(commentFeedRows(undefined, NOW)).toEqual([]);
    expect(commentFeedRows(empty, NOW)).toEqual([]);
  });

  it("derives the header summary from visible rows and the untruncated total", () => {
    expect(commentFeedSummary(commentFeedRows(populated, NOW), 9)).toBe(
      "9 comments · latest in A Short Film",
    );
    expect(commentFeedSummary(commentFeedRows(populated, NOW))).toBe(
      "2 comments · latest in A Short Film",
    );
    expect(commentFeedSummary([], 0)).toBe("No comments");
  });

  it("formats the generated-at footer and tolerates missing feeds", () => {
    expect(commentFeedGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(commentFeedGeneratedAtLabel(empty, NOW)).toBe("1 hour ago");
    expect(commentFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("derives scope-aware empty-state copy", () => {
    expect(commentFeedEmptyDescription(false)).toContain("Collaboration comments");
    expect(commentFeedEmptyDescription(true)).toContain("this project");
  });

  it("normalizes whitespace and bounds long comment bodies", () => {
    expect(commentBodyPreview("  a\t b\n c  ")).toBe("a b c");
    expect(commentBodyPreview("")).toBe("No comment text");
    const long = "x".repeat(300);
    const preview = commentBodyPreview(long, 20);
    expect(preview).toHaveLength(20);
    expect(preview.endsWith("…")).toBe(true);
    expect(commentBodyPreview("short", 20)).toBe("short");
  });

  it("derives compact labels for opaque ids with stable fallbacks", () => {
    expect(shortIdLabel("abcdef1234567890", "Author")).toBe("Author abcdef12…");
    expect(shortIdLabel("tiny", "Asset")).toBe("Asset tiny");
    expect(shortIdLabel("  ", "Author")).toBe("Author");
  });

  it("stays render-safe for a comment with an absent asset reference and body", () => {
    const rows = commentFeedRows({
      ...populated,
      items: [{ ...plainComment, body: undefined as unknown as string }],
    });
    expect(rows[0]?.hasAsset).toBe(false);
    expect(rows[0]?.bodyPreview).toBe("No comment text");
  });
});
