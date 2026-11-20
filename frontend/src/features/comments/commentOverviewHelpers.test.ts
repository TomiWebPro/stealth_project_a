import { describe, expect, it } from "vitest";
import type { CommentOverview } from "../../lib/types";
import type { CommentFeedRow } from "./commentFeedHelpers";
import {
  COMMENT_OVERVIEW_RECENT_LIMIT,
  buildCommentOverviewOptions,
  commentOverviewActiveOption,
  commentOverviewCount,
  commentOverviewCountRows,
  commentOverviewEmptyDescription,
  commentOverviewGeneratedAtLabel,
  commentOverviewIdentity,
  commentOverviewPickerOptions,
  commentOverviewRecentComments,
  commentOverviewReferenceLabel,
  commentOverviewReferenceTone,
  commentOverviewRelativeLabel,
  commentOverviewSummaryLabel,
  hasCommentOverviewData,
} from "./commentOverviewHelpers";

const NOW = Date.parse("2026-01-01T12:00:00Z");

const populated: CommentOverview = {
  comment_id: "0b5c1e2a-6200-4000-8000-000000000001",
  project_id: "proj-bbbb-2222",
  project_name: "A Short Film",
  asset_id: "asset-aaaa-1111",
  author_id: "user-cccc-3333",
  body: "  Need a  final   pass  on the hero render.  ",
  created_at: "2026-01-01T09:00:00Z",
  reference: "asset",
  counts: {
    project_comments: 18,
    project_authors: 4,
    project_assets: 3,
    thread_comments: 6,
  },
  recent_comments: [
    {
      comment_id: "0b5c1e2a-6200-4000-8000-000000000009",
      project_id: "proj-bbbb-2222",
      project_name: "A Short Film",
      asset_id: "asset-aaaa-1111",
      author_id: "user-dddd-4444",
      body: "Latest note on the same asset thread.",
      created_at: "2026-01-01T10:00:00Z",
    },
    {
      comment_id: "0b5c1e2a-6200-4000-8000-000000000008",
      project_id: "proj-bbbb-2222",
      project_name: "A Short Film",
      asset_id: null,
      author_id: "user-eeee-5555",
      body: "Project-level note.",
      created_at: "2026-01-01T08:00:00Z",
    },
  ],
  generated_at: "2026-01-01T11:59:00Z",
};

const rows: readonly CommentFeedRow[] = [
  {
    id: "0b5c1e2a-6200-4000-8000-000000000001",
    commentId: "0b5c1e2a-6200-4000-8000-000000000001",
    projectId: "proj-bbbb-2222",
    projectName: "A Short Film",
    assetId: "asset-aaaa-1111",
    hasAsset: true,
    assetLabel: "Asset asset-aa…",
    authorId: "user-cccc-3333",
    authorLabel: "Author user-cc…",
    authorTone: "info",
    body: "Need a final pass on the hero render.",
    bodyPreview: "Need a final pass on the hero render.",
    timestamp: "2026-01-01T09:00:00Z",
    relativeTime: "3h ago",
  },
];

describe("comment overview display helpers", () => {
  it("returns zero-filled counts for missing, negative or malformed snapshots", () => {
    expect(commentOverviewCount(undefined)).toBe(0);
    expect(commentOverviewCount(null, "thread_comments")).toBe(0);
    expect(
      commentOverviewCount(
        { ...populated, counts: { ...populated.counts, project_comments: Number.NaN } },
        "project_comments",
      ),
    ).toBe(0);
    expect(
      commentOverviewCount(
        { ...populated, counts: { ...populated.counts, project_authors: -3 } },
        "project_authors",
      ),
    ).toBe(0);
    expect(commentOverviewCount(populated, "project_comments")).toBe(18);
    expect(commentOverviewCount(populated, "thread_comments")).toBe(6);
  });

  it("derives all four count rows in a stable, zero-filled order", () => {
    expect(commentOverviewCountRows(populated)).toEqual([
      { key: "project_comments", label: "Comments", hint: "Comments in this project", value: "18" },
      { key: "project_authors", label: "Authors", hint: "Distinct commenters in project", value: "4" },
      { key: "project_assets", label: "Assets", hint: "Assets referenced in project", value: "3" },
      { key: "thread_comments", label: "Thread", hint: "Comments in this thread", value: "6" },
    ]);
    expect(commentOverviewCountRows(undefined).map((row) => row.value)).toEqual(["0", "0", "0", "0"]);
  });

  it("formats relative and generated-at labels", () => {
    expect(commentOverviewRelativeLabel("2026-01-01T11:00:00Z", NOW)).toBeTruthy();
    expect(commentOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(commentOverviewGeneratedAtLabel(populated, NOW)).toBeTruthy();
    expect(commentOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("labels reference categories defensively", () => {
    expect(commentOverviewReferenceLabel("asset")).toBe("Asset reference");
    expect(commentOverviewReferenceLabel("project")).toBe("Project-level");
    expect(commentOverviewReferenceLabel(undefined)).toBe("Comment");
    expect(commentOverviewReferenceTone("asset")).toBe("accent");
    expect(commentOverviewReferenceTone("project")).toBe("info");
    expect(commentOverviewReferenceTone(undefined)).toBe("neutral");
  });

  it("derives identity, reference badge and body preview for a populated snapshot", () => {
    const identity = commentOverviewIdentity(populated, NOW);
    expect(identity.authorLabel).toBe("Author user-ccc…");
    expect(identity.referenceLabel).toBe("Asset reference");
    expect(identity.referenceTone).toBe("accent");
    expect(identity.hasAsset).toBe(true);
    expect(identity.assetLabel).toBe("Asset asset-aa…");
    expect(identity.projectLabel).toBe("A Short Film");
    expect(identity.bodyPreview).toBe("Need a final pass on the hero render.");
    expect(identity.createdLabel).toBeTruthy();
  });

  it("derives a project-level identity and a fully zero-filled identity when missing", () => {
    const projectLevel = commentOverviewIdentity(
      { ...populated, asset_id: null, reference: "project" },
      NOW,
    );
    expect(projectLevel.hasAsset).toBe(false);
    expect(projectLevel.assetLabel).toBe("");
    expect(projectLevel.referenceLabel).toBe("Project-level");
    expect(projectLevel.referenceTone).toBe("info");

    const empty = commentOverviewIdentity(undefined, NOW);
    expect(empty.authorLabel).toBe("—");
    expect(empty.referenceLabel).toBe("Comment");
    expect(empty.referenceTone).toBe("neutral");
    expect(empty.hasAsset).toBe(false);
    expect(empty.projectLabel).toBe("");
    expect(empty.bodyPreview).toBe("No comment text");
  });

  it("projects same-thread sibling comments into render-safe rows", () => {
    const siblings = commentOverviewRecentComments(populated, NOW);
    expect(siblings).toHaveLength(2);
    expect(siblings[0]).toMatchObject({ hasAsset: true, assetLabel: "Asset asset-aa…" });
    expect(siblings[1]).toMatchObject({ hasAsset: false, assetLabel: "" });
    expect(siblings[0]?.relativeTime).toBeTruthy();
    expect(commentOverviewRecentComments(undefined, NOW)).toEqual([]);
  });

  it("detects whether the snapshot carries any data", () => {
    expect(hasCommentOverviewData(populated)).toBe(true);
    expect(
      hasCommentOverviewData({
        ...populated,
        counts: { project_comments: 0, project_authors: 0, project_assets: 0, thread_comments: 0 },
        recent_comments: [],
      }),
    ).toBe(false);
    expect(
      hasCommentOverviewData({
        ...populated,
        counts: { project_comments: 0, project_authors: 0, project_assets: 0, thread_comments: 0 },
        recent_comments: populated.recent_comments,
      }),
    ).toBe(true);
    expect(hasCommentOverviewData(undefined)).toBe(false);
  });

  it("derives a one-line summary", () => {
    expect(commentOverviewSummaryLabel(populated)).toBe("18 comments · 4 authors · 6 in thread");
    expect(commentOverviewSummaryLabel(undefined)).toBe("");
  });

  it("provides filter-aware empty-state copy", () => {
    expect(commentOverviewEmptyDescription(true)).toContain("project");
    expect(commentOverviewEmptyDescription(false)).toContain("teammates");
  });

  it("derives picker options from comment-feed rows", () => {
    expect(commentOverviewPickerOptions(rows)).toEqual([
      {
        value: "0b5c1e2a-6200-4000-8000-000000000001",
        label: "Need a final pass on the hero render. · A Short Film",
        commentId: "0b5c1e2a-6200-4000-8000-000000000001",
      },
    ]);
    expect(commentOverviewPickerOptions([])).toEqual([]);
  });

  it("resolves the active picker option with a first-row fallback", () => {
    const options = commentOverviewPickerOptions(rows);
    expect(options[0]?.commentId).toBe("0b5c1e2a-6200-4000-8000-000000000001");
    expect(commentOverviewActiveOption(options, "stale")?.commentId).toBe(
      "0b5c1e2a-6200-4000-8000-000000000001",
    );
    expect(commentOverviewActiveOption([], "")).toBeUndefined();
  });

  it("builds bounded sibling query options", () => {
    expect(COMMENT_OVERVIEW_RECENT_LIMIT).toBe(5);
    expect(buildCommentOverviewOptions()).toEqual({ recentLimit: 5 });
    expect(buildCommentOverviewOptions(3)).toEqual({ recentLimit: 3 });
  });
});
