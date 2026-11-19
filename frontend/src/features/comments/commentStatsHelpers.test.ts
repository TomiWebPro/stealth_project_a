import { describe, expect, it } from "vitest";
import type { CommentStats } from "../../lib/types";
import {
  commentAuthorRows,
  commentProjectRows,
  commentReferenceRows,
  commentStatsCards,
  commentStatsGeneratedAtLabel,
  commentStatsRelativeLabel,
  hasCommentStatsData,
  newestCommentLabel,
  shortCommentEntityId,
} from "./commentStatsHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const AUTHOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTHOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const populated: CommentStats = {
  total_comments: 4,
  total_authors: 2,
  total_projects: 2,
  by_reference: [
    { reference: "asset", count: 3 },
    { reference: "project", count: 1 },
  ],
  by_project: [
    { project_id: PROJECT_A, comments: 3, authors: 2 },
    { project_id: PROJECT_B, comments: 1, authors: 1 },
  ],
  by_author: [
    { author_id: AUTHOR_A, comments: 3 },
    { author_id: AUTHOR_B, comments: 1 },
  ],
  newest_comment_at: "2026-01-01T00:45:00Z",
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: CommentStats = {
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
  generated_at: "2026-01-01T00:00:00Z",
};

describe("comment stats formatters", () => {
  it("shortens long entity ids and keeps short ones intact", () => {
    expect(shortCommentEntityId(PROJECT_A)).toBe("11111111…");
    expect(shortCommentEntityId("short")).toBe("short");
  });

  it("formats relative labels and treats invalid timestamps as raw values", () => {
    expect(commentStatsRelativeLabel(null)).toBe("");
    expect(commentStatsRelativeLabel(undefined)).toBe("");
    expect(commentStatsRelativeLabel("2026-01-01T00:30:00Z", NOW)).toBe("30 minutes ago");
    expect(commentStatsRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("derives the newest-comment recency label", () => {
    expect(newestCommentLabel(populated, NOW)).toBe("15 minutes ago");
    expect(newestCommentLabel(empty, NOW)).toBe("");
    expect(newestCommentLabel(undefined, NOW)).toBe("");
  });
});

describe("commentStatsCards", () => {
  it("derives the three counters plus the newest-comment recency in a stable order", () => {
    const cards = commentStatsCards(populated, NOW);
    expect(cards.map((card) => card.key)).toEqual(["comments", "authors", "projects", "latest"]);
    expect(cards.map((card) => card.value)).toEqual(["4", "2", "2", "15 minutes ago"]);
  });

  it("zero-fills every counter when the snapshot is absent or empty", () => {
    expect(commentStatsCards(undefined, NOW).map((card) => card.value)).toEqual([
      "0",
      "0",
      "0",
      "—",
    ]);
    expect(commentStatsCards(empty, NOW)[3]?.value).toBe("—");
  });
});

describe("commentReferenceRows", () => {
  it("returns a complete zero-filled asset/project breakdown with shares", () => {
    const rows = commentReferenceRows(populated);
    expect(rows.map((row) => row.reference)).toEqual(["asset", "project"]);
    expect(rows[0]).toMatchObject({
      label: "Asset references",
      count: 3,
      percent: 75,
      fraction: 0.75,
      tone: "accent",
    });
    expect(rows[1]).toMatchObject({ label: "Project-level", count: 1, percent: 25, tone: "info" });
  });

  it("ignores malformed entries and never divides by zero on empty snapshots", () => {
    const rows = commentReferenceRows({
      ...populated,
      by_reference: [
        { reference: "asset", count: Number.NaN },
        { reference: "project", count: 4 },
      ],
    });
    expect(rows[0]?.count).toBe(0);
    expect(rows[1]?.percent).toBe(100);
    expect(commentReferenceRows(undefined).every((row) => row.fraction === 0)).toBe(true);
    expect(commentReferenceRows(empty).every((row) => row.percent === 0)).toBe(true);
  });
});

describe("commentProjectRows", () => {
  it("derives per-project activity with friendly names and a short-id fallback", () => {
    const rows = commentProjectRows(populated, { [PROJECT_B]: "Effects Short" });
    expect(rows.map((row) => row.projectId)).toEqual([PROJECT_A, PROJECT_B]);
    expect(rows[0]).toMatchObject({
      label: "11111111…",
      comments: 3,
      authors: 2,
      activity: 5,
    });
    expect(rows[1]).toMatchObject({ label: "Effects Short", activity: 2 });
  });

  it("re-sorts unsafely ordered entries and zero-fills when absent", () => {
    const rows = commentProjectRows({
      ...populated,
      by_project: [
        { project_id: PROJECT_B, comments: 1, authors: 1 },
        { project_id: PROJECT_A, comments: 3, authors: 2 },
      ],
    });
    expect(rows.map((row) => row.projectId)).toEqual([PROJECT_A, PROJECT_B]);
    expect(commentProjectRows(undefined)).toEqual([]);
    expect(commentProjectRows(empty)).toEqual([]);
  });
});

describe("commentAuthorRows", () => {
  it("derives per-author comment counts in deterministic order", () => {
    const rows = commentAuthorRows(populated);
    expect(rows.map((row) => row.authorId)).toEqual([AUTHOR_A, AUTHOR_B]);
    expect(rows[0]).toMatchObject({ label: "aaaaaaaa…", comments: 3 });
  });

  it("re-sorts unsafely ordered entries and filters malformed ones", () => {
    const rows = commentAuthorRows({
      ...populated,
      by_author: [
        { author_id: AUTHOR_B, comments: 1 },
        { author_id: AUTHOR_A, comments: 3 },
        { author_id: AUTHOR_A, comments: Number.NaN },
      ],
    });
    expect(rows.map((row) => row.authorId)).toEqual([AUTHOR_A, AUTHOR_B]);
    expect(commentAuthorRows(undefined)).toEqual([]);
    expect(commentAuthorRows(empty)).toEqual([]);
  });
});

describe("hasCommentStatsData and commentStatsGeneratedAtLabel", () => {
  it("detects empty snapshots across all three counters", () => {
    expect(hasCommentStatsData(populated)).toBe(true);
    expect(hasCommentStatsData(empty)).toBe(false);
    expect(hasCommentStatsData(undefined)).toBe(false);
    expect(hasCommentStatsData({ ...empty, total_comments: 3 })).toBe(true);
  });

  it("derives a generated-at footer label", () => {
    expect(commentStatsGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(commentStatsGeneratedAtLabel(undefined, NOW)).toBe("");
  });
});
