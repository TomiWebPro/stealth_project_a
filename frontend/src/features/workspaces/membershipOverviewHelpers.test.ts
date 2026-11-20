import { describe, expect, it } from "vitest";
import type { MembershipOverview } from "../../lib/types";
import {
  MEMBERSHIP_OVERVIEW_RECENT_LIMIT,
  buildMembershipOverviewOptions,
  hasMembershipOverviewData,
  membershipOverviewAvatarInitial,
  membershipOverviewCommentPreview,
  membershipOverviewCount,
  membershipOverviewCounts,
  membershipOverviewDisplayName,
  membershipOverviewGeneratedAtLabel,
  membershipOverviewIdentity,
  membershipOverviewLifecycle,
  membershipOverviewOrgName,
  membershipOverviewRecentComments,
  membershipOverviewRecentProjects,
  membershipOverviewRelativeLabel,
  membershipOverviewRole,
  membershipOverviewShortId,
  membershipOverviewStatRows,
  membershipOverviewSummaryLabel,
} from "./membershipOverviewHelpers";

const NOW = Date.parse("2026-01-01T12:00:00Z");
const USER_ID = "aaaaaaaa-0000-4000-8000-0000000000ff";
const ORG_ID = "bbbbbbbb-0000-4000-8000-0000000000ee";

function overview(overrides: Partial<MembershipOverview> = {}): MembershipOverview {
  return {
    org_id: ORG_ID,
    org_name: "Northwind Studio",
    org_slug: "northwind",
    user_id: USER_ID,
    email: "ada@example.com",
    display_name: "Ada Lovelace",
    role: "admin",
    joined_at: "2026-01-01T09:00:00Z",
    counts: {
      projects: 5,
      conversations: 7,
      comments: 11,
      presence: 1,
    },
    recent_projects: [
      {
        id: "proj-1",
        org_id: ORG_ID,
        name: "Short Film",
        created_by: USER_ID,
        created_at: "2026-01-01T07:00:00Z",
        updated_at: "2026-01-01T11:00:00Z",
        archived: false,
      },
      {
        id: "proj-2",
        org_id: ORG_ID,
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

describe("membershipOverviewHelpers zero-fill", () => {
  it("returns zero-filled counts and stat rows for a missing snapshot", () => {
    expect(membershipOverviewCounts(undefined)).toEqual({
      projects: 0,
      conversations: 0,
      comments: 0,
      presence: 0,
    });
    expect(membershipOverviewStatRows(null).map((row) => row.value)).toEqual(["0", "0", "0", "0"]);
    expect(membershipOverviewStatRows().map((row) => row.key)).toEqual([
      "projects",
      "conversations",
      "comments",
      "presence",
    ]);
  });

  it("coerces malformed raw counts to zero", () => {
    const malformed = overview({
      counts: {
        projects: -3,
        conversations: Number.NaN,
        comments: 2.9,
        presence: "x" as unknown as number,
      },
    });
    expect(membershipOverviewCount(malformed, "projects")).toBe(0);
    expect(membershipOverviewCount(malformed, "conversations")).toBe(0);
    expect(membershipOverviewCount(malformed, "comments")).toBe(2);
    expect(membershipOverviewCount(malformed, "presence")).toBe(0);
  });

  it("has no data only when the snapshot is missing or entirely empty", () => {
    expect(hasMembershipOverviewData(undefined)).toBe(false);
    expect(hasMembershipOverviewData(null)).toBe(false);
    expect(hasMembershipOverviewData(overview())).toBe(true);
    expect(
      hasMembershipOverviewData(
        overview({
          counts: { projects: 0, conversations: 0, comments: 0, presence: 0 },
          recent_projects: [],
          recent_comments: [],
        }),
      ),
    ).toBe(false);
    expect(
      hasMembershipOverviewData(
        overview({
          counts: { projects: 0, conversations: 0, comments: 0, presence: 0 },
          recent_projects: [],
          recent_comments: [{ id: "c" } as never],
        }),
      ),
    ).toBe(true);
  });
});

describe("membershipOverviewHelpers identity", () => {
  it("derives identity/context labels and role/tone", () => {
    expect(membershipOverviewIdentity(overview(), NOW)).toEqual({
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      avatarInitial: "A",
      shortId: "aaaaaaaa…",
      orgName: "Northwind Studio",
      orgSlug: "northwind",
      roleLabel: "Admin",
      roleTone: "info",
      joinedLabel: "3 hours ago",
    });
  });

  it("falls back from display name to email to unknown user and org", () => {
    expect(membershipOverviewDisplayName(overview({ display_name: "  " }))).toBe("ada@example.com");
    expect(membershipOverviewDisplayName(overview({ display_name: "  ", email: "  " }))).toBe(
      "Unknown user",
    );
    expect(membershipOverviewAvatarInitial(undefined)).toBe("U");
    expect(membershipOverviewOrgName(overview({ org_name: "  " }))).toBe("Unknown organization");
    expect(membershipOverviewShortId("short")).toBe("short");
    expect(membershipOverviewShortId(undefined)).toBe("—");
  });

  it("formats relative labels and the generated-at footer", () => {
    expect(membershipOverviewRelativeLabel(undefined, NOW)).toBe("");
    expect(membershipOverviewRelativeLabel("2026-01-01T11:00:00Z", NOW)).toBe("1 hour ago");
    expect(membershipOverviewGeneratedAtLabel(overview(), NOW)).toBe("1 minute ago");
    expect(membershipOverviewGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("builds a one-line summary with pluralization", () => {
    expect(membershipOverviewSummaryLabel(overview())).toBe(
      "5 projects · 11 comments · Northwind Studio",
    );
    expect(membershipOverviewSummaryLabel(undefined)).toBe("");
    expect(
      membershipOverviewSummaryLabel(
        overview({
          counts: { projects: 1, conversations: 0, comments: 1, presence: 0 },
        }),
      ),
    ).toBe("1 project · 1 comment · Northwind Studio");
  });
});

describe("membershipOverviewHelpers role", () => {
  it("maps canonical roles to labels and tones with a stable fallback", () => {
    expect(membershipOverviewRole("owner")).toEqual({ label: "Owner", tone: "accent" });
    expect(membershipOverviewRole("admin")).toEqual({ label: "Admin", tone: "info" });
    expect(membershipOverviewRole("member")).toEqual({ label: "Member", tone: "success" });
    expect(membershipOverviewRole("viewer")).toEqual({ label: "Viewer", tone: "neutral" });
    expect(membershipOverviewRole(undefined)).toEqual({ label: "Unknown", tone: "neutral" });
    expect(membershipOverviewRole("editor" as never).label).toBe("editor");
  });
});

describe("membershipOverviewHelpers recent rows", () => {
  it("projects recent projects with lifecycle badges and fallbacks", () => {
    expect(membershipOverviewLifecycle(overview().recent_projects![0])).toEqual({
      label: "Active",
      tone: "success",
    });
    expect(membershipOverviewLifecycle(overview().recent_projects![1])).toEqual({
      label: "Archived",
      tone: "neutral",
    });
    const rows = membershipOverviewRecentProjects(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "proj-1",
      name: "Short Film",
      lifecycleLabel: "Active",
      lifecycleTone: "success",
      updatedLabel: "1 hour ago",
    });
    expect(rows[1]).toMatchObject({ name: "Unnamed project", lifecycleLabel: "Archived" });
    expect(membershipOverviewRecentProjects(undefined)).toEqual([]);
  });

  it("normalizes and truncates comment body previews", () => {
    expect(membershipOverviewCommentPreview("  Ship the   final cut\n today ")).toBe(
      "Ship the final cut today",
    );
    expect(membershipOverviewCommentPreview(undefined)).toBe("");
    expect(membershipOverviewCommentPreview("x".repeat(200)).endsWith("…")).toBe(true);
    expect(membershipOverviewCommentPreview("x".repeat(200)).length).toBe(120);
  });

  it("projects recent comments with asset and project context", () => {
    const rows = membershipOverviewRecentComments(overview(), NOW);
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
    expect(membershipOverviewRecentComments(undefined)).toEqual([]);
  });
});

describe("membershipOverviewHelpers query options", () => {
  it("uses a bounded default and honors a custom recent limit", () => {
    expect(buildMembershipOverviewOptions()).toEqual({ recentLimit: MEMBERSHIP_OVERVIEW_RECENT_LIMIT });
    expect(buildMembershipOverviewOptions(3)).toEqual({ recentLimit: 3 });
  });
});
