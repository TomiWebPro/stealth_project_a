import { describe, expect, it } from "vitest";
import type { UserOverview } from "../../lib/types";
import {
  USER_OVERVIEW_RECENT_LIMIT,
  buildUserOverviewOptions,
  hasUserOverviewData,
  userOverviewAvatarInitial,
  userOverviewCommentPreview,
  userOverviewCount,
  userOverviewCounts,
  userOverviewDisplayName,
  userOverviewGeneratedAtLabel,
  userOverviewIdentity,
  userOverviewLifecycle,
  userOverviewMembershipRows,
  userOverviewRecentComments,
  userOverviewRecentProjects,
  userOverviewRelativeLabel,
  userOverviewRole,
  userOverviewShortId,
  userOverviewStatRows,
  userOverviewSummaryLabel,
} from "./userOverviewHelpers";

const NOW = Date.parse("2026-01-01T12:00:00Z");
const USER_ID = "aaaaaaaa-0000-4000-8000-0000000000ff";

function overview(overrides: Partial<UserOverview> = {}): UserOverview {
  return {
    user_id: USER_ID,
    email: "ada@example.com",
    display_name: "Ada Lovelace",
    created_at: "2026-01-01T08:00:00Z",
    counts: {
      organizations: 2,
      projects: 5,
      conversations: 7,
      comments: 11,
      presence: 1,
    },
    memberships: [
      {
        org_id: "org-1",
        org_name: "Northwind Studio",
        role: "owner",
        joined_at: "2026-01-01T09:00:00Z",
      },
      {
        org_id: "org-2",
        org_name: "  ",
        role: "viewer",
        joined_at: "2026-01-01T10:30:00Z",
      },
    ],
    recent_projects: [
      {
        id: "proj-1",
        org_id: "org-1",
        name: "Short Film",
        created_by: USER_ID,
        created_at: "2026-01-01T07:00:00Z",
        updated_at: "2026-01-01T11:00:00Z",
        archived: false,
      },
      {
        id: "proj-2",
        org_id: "org-1",
        name: "  ",
        created_by: USER_ID,
        created_at: "2026-01-01T06:00:00Z",
        updated_at: "2026-01-01T06:30:00Z",
        archived: true,
      },
    ],
    recent_comments: [
      {
        id: "comment-1",
        project_id: "proj-1",
        asset_id: "asset-1",
        author_id: USER_ID,
        body: "  Ship the   final cut\n today ",
        created_at: "2026-01-01T11:30:00Z",
      },
      {
        id: "comment-2",
        project_id: "proj-2",
        author_id: USER_ID,
        body: "Reviewed the splat",
        created_at: "2026-01-01T10:00:00Z",
      },
    ],
    generated_at: "2026-01-01T11:59:00Z",
    ...overrides,
  };
}

describe("userOverviewHelpers zero-fill", () => {
  it("returns zero-filled counts and stat rows for a missing snapshot", () => {
    expect(userOverviewCounts(undefined)).toEqual({
      organizations: 0,
      projects: 0,
      conversations: 0,
      comments: 0,
      presence: 0,
    });
    expect(userOverviewStatRows(null).map((row) => row.value)).toEqual(["0", "0", "0", "0", "0"]);
    expect(userOverviewStatRows().map((row) => row.key)).toEqual([
      "organizations",
      "projects",
      "conversations",
      "comments",
      "presence",
    ]);
  });

  it("coerces malformed raw counts to zero", () => {
    const malformed = overview({
      counts: {
        organizations: -3,
        projects: Number.NaN,
        conversations: 2.9,
        comments: "x" as unknown as number,
        presence: 1,
      },
    });
    expect(userOverviewCount(malformed, "organizations")).toBe(0);
    expect(userOverviewCount(malformed, "projects")).toBe(0);
    expect(userOverviewCount(malformed, "conversations")).toBe(2);
    expect(userOverviewCount(malformed, "comments")).toBe(0);
    expect(userOverviewCount(malformed, "presence")).toBe(1);
  });

  it("has no data only when the snapshot is missing or entirely empty", () => {
    expect(hasUserOverviewData(undefined)).toBe(false);
    expect(hasUserOverviewData(null)).toBe(false);
    expect(hasUserOverviewData(overview())).toBe(true);
    expect(
      hasUserOverviewData(
        overview({
          counts: { organizations: 0, projects: 0, conversations: 0, comments: 0, presence: 0 },
          memberships: [],
          recent_projects: [],
          recent_comments: [],
        }),
      ),
    ).toBe(false);
    expect(
      hasUserOverviewData(
        overview({
          counts: { organizations: 0, projects: 0, conversations: 0, comments: 0, presence: 0 },
          memberships: [],
          recent_projects: [],
          recent_comments: [{ id: "c" } as never],
        }),
      ),
    ).toBe(true);
  });
});

describe("userOverviewHelpers identity", () => {
  it("derives identity labels and a stable short id", () => {
    expect(userOverviewIdentity(overview(), NOW)).toEqual({
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      avatarInitial: "A",
      shortId: "aaaaaaaa…",
      createdLabel: "4 hours ago",
    });
  });

  it("falls back from display name to email to unknown user", () => {
    expect(userOverviewDisplayName(overview({ display_name: "  " }))).toBe("ada@example.com");
    expect(userOverviewDisplayName(overview({ display_name: "  ", email: "  " }))).toBe(
      "Unknown user",
    );
    expect(userOverviewAvatarInitial(undefined)).toBe("U");
    expect(userOverviewShortId("short")).toBe("short");
    expect(userOverviewShortId(undefined)).toBe("—");
  });

  it("formats relative labels and the generated-at footer", () => {
    expect(userOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(userOverviewRelativeLabel("2026-01-01T11:00:00Z", NOW)).toBe("1 hour ago");
    expect(userOverviewGeneratedAtLabel(overview(), NOW)).toBe("1 minute ago");
    expect(userOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("builds a one-line summary with pluralization", () => {
    expect(userOverviewSummaryLabel(overview())).toBe("2 orgs · 5 projects · 11 comments");
    expect(userOverviewSummaryLabel(undefined)).toBe("");
    expect(
      userOverviewSummaryLabel(
        overview({
          counts: { organizations: 1, projects: 1, conversations: 0, comments: 1, presence: 0 },
        }),
      ),
    ).toBe("1 org · 1 project · 1 comment");
  });
});

describe("userOverviewHelpers role and membership rows", () => {
  it("maps canonical roles to labels and tones with a stable fallback", () => {
    expect(userOverviewRole("owner")).toEqual({ label: "Owner", tone: "accent" });
    expect(userOverviewRole("admin")).toEqual({ label: "Admin", tone: "info" });
    expect(userOverviewRole("member")).toEqual({ label: "Member", tone: "success" });
    expect(userOverviewRole("viewer")).toEqual({ label: "Viewer", tone: "neutral" });
    expect(userOverviewRole(undefined)).toEqual({ label: "Unknown", tone: "neutral" });
    expect(userOverviewRole("editor" as never).label).toBe("editor");
  });

  it("projects memberships with joined names, roles and recency", () => {
    expect(userOverviewMembershipRows(overview(), NOW)).toEqual([
      {
        key: "org-1",
        orgName: "Northwind Studio",
        roleLabel: "Owner",
        roleTone: "accent",
        joinedLabel: "3 hours ago",
      },
      {
        key: "org-2",
        orgName: "Unknown organization",
        roleLabel: "Viewer",
        roleTone: "neutral",
        joinedLabel: "1 hour ago",
      },
    ]);
    expect(userOverviewMembershipRows(undefined)).toEqual([]);
  });
});

describe("userOverviewHelpers recent rows", () => {
  it("projects recent projects with lifecycle badges and fallbacks", () => {
    expect(userOverviewLifecycle(overview().recent_projects![0])).toEqual({
      label: "Active",
      tone: "success",
    });
    expect(userOverviewLifecycle(overview().recent_projects![1])).toEqual({
      label: "Archived",
      tone: "neutral",
    });
    const rows = userOverviewRecentProjects(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "proj-1",
      name: "Short Film",
      lifecycleLabel: "Active",
      lifecycleTone: "success",
      createdLabel: "5 hours ago",
      updatedLabel: "1 hour ago",
    });
    expect(rows[1]).toMatchObject({ name: "Unnamed project", lifecycleLabel: "Archived" });
    expect(userOverviewRecentProjects(undefined)).toEqual([]);
  });

  it("normalizes and truncates comment body previews", () => {
    expect(userOverviewCommentPreview("  Ship the   final cut\n today ")).toBe(
      "Ship the final cut today",
    );
    expect(userOverviewCommentPreview(undefined)).toBe("");
    expect(userOverviewCommentPreview("x".repeat(200)).endsWith("…")).toBe(true);
    expect(userOverviewCommentPreview("x".repeat(200)).length).toBe(120);
  });

  it("projects recent comments with asset and project context", () => {
    const rows = userOverviewRecentComments(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "comment-1",
      projectId: "proj-1",
      assetId: "asset-1",
      hasAsset: true,
      bodyPreview: "Ship the final cut today",
      createdLabel: "30 minutes ago",
    });
    expect(rows[1]).toMatchObject({ hasAsset: false, assetId: "" });
    expect(userOverviewRecentComments(undefined)).toEqual([]);
  });
});

describe("userOverviewHelpers query options", () => {
  it("uses a bounded default and honors a custom recent limit", () => {
    expect(buildUserOverviewOptions()).toEqual({ recentLimit: USER_OVERVIEW_RECENT_LIMIT });
    expect(buildUserOverviewOptions(3)).toEqual({ recentLimit: 3 });
  });
});
