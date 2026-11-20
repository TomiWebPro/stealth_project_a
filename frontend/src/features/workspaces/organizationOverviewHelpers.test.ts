import { describe, expect, it } from "vitest";
import type { Organization, OrganizationOverview } from "../../lib/types";
import {
  hasOrganizationOverviewData,
  organizationOverviewActiveRoleCount,
  organizationOverviewCounts,
  organizationOverviewGeneratedAtLabel,
  organizationOverviewIdentity,
  organizationOverviewLifecycle,
  organizationOverviewName,
  organizationOverviewOptionLabel,
  organizationOverviewRecentMembers,
  organizationOverviewRecentProjects,
  organizationOverviewRelativeLabel,
  organizationOverviewRoleRows,
  organizationOverviewShortId,
  organizationOverviewStatRows,
  organizationOverviewSummaryLabel,
} from "./organizationOverviewHelpers";

const NOW = Date.parse("2026-01-01T12:00:00Z");

function overview(overrides: Partial<OrganizationOverview> = {}): OrganizationOverview {
  return {
    org_id: "aaaaaaaa-0000-4000-8000-000000000001",
    name: "Northwind Studio",
    slug: "northwind",
    created_at: "2026-01-01T09:00:00Z",
    counts: { members: 5, projects: 3 },
    by_role: [
      { role: "owner", members: 1 },
      { role: "admin", members: 1 },
      { role: "member", members: 2 },
      { role: "viewer", members: 1 },
    ],
    recent_members: [
      {
        user_id: "user-1",
        email: "ada@example.com",
        display_name: "Ada Lovelace",
        role: "owner",
        joined_at: "2026-01-01T10:00:00Z",
      },
      {
        user_id: "user-2",
        email: "grace@example.com",
        display_name: "  ",
        role: "viewer",
        joined_at: "2026-01-01T11:00:00Z",
      },
    ],
    recent_projects: [
      {
        id: "proj-1",
        org_id: "aaaaaaaa-0000-4000-8000-000000000001",
        name: "Short Film",
        created_by: "user-1",
        created_at: "2026-01-01T08:00:00Z",
        updated_at: "2026-01-01T11:30:00Z",
        archived: false,
      },
      {
        id: "proj-2",
        org_id: "aaaaaaaa-0000-4000-8000-000000000001",
        name: "Old Pilot",
        created_by: "user-1",
        created_at: "2026-01-01T07:00:00Z",
        updated_at: "2026-01-01T10:00:00Z",
        archived: true,
      },
    ],
    generated_at: "2026-01-01T11:59:30Z",
    ...overrides,
  };
}

function org(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    name: "Northwind Studio",
    slug: "northwind",
    created_at: "2026-01-01T09:00:00Z",
    ...overrides,
  };
}

describe("organizationOverview formatters", () => {
  it("formats relative labels defensively", () => {
    expect(organizationOverviewRelativeLabel(null)).toBe("");
    expect(organizationOverviewRelativeLabel(undefined)).toBe("");
    expect(organizationOverviewRelativeLabel("2026-01-01T09:00:00Z", NOW)).toBe("3 hours ago");
    expect(organizationOverviewRelativeLabel("not-a-date", NOW)).toBe("not-a-date");
  });

  it("formats the generated-at footer label", () => {
    expect(organizationOverviewGeneratedAtLabel(overview(), NOW)).toBe("30 seconds ago");
    expect(organizationOverviewGeneratedAtLabel(undefined)).toBe("");
  });

  it("derive defensive short-id and name labels", () => {
    expect(organizationOverviewShortId("aaaaaaaa-0000-4000-8000-000000000001")).toBe("aaaaaaaa…");
    expect(organizationOverviewShortId("short")).toBe("short");
    expect(organizationOverviewShortId(undefined)).toBe("—");
    expect(organizationOverviewName(overview())).toBe("Northwind Studio");
    expect(organizationOverviewName(overview({ name: "  ", slug: "fallback" }))).toBe("fallback");
    expect(organizationOverviewName(overview({ name: "  ", slug: "  " }))).toBe(
      "Unknown organization",
    );
    expect(organizationOverviewName(undefined)).toBe("Unknown organization");
  });

  it("builds picker labels and identity from the organization", () => {
    expect(organizationOverviewOptionLabel(org())).toBe("Northwind Studio · @northwind");
    expect(organizationOverviewOptionLabel(org({ name: "  ", slug: "" }))).toBe(
      "Unnamed organization",
    );
    const identity = organizationOverviewIdentity(overview(), NOW);
    expect(identity.nameLabel).toBe("Northwind Studio");
    expect(identity.slugLabel).toBe("@northwind");
    expect(identity.shortIdLabel).toBe("aaaaaaaa…");
    expect(identity.createdLabel).toBe("3 hours ago");
    expect(organizationOverviewIdentity(overview({ slug: "" })).slugLabel).toBe("—");
  });
});

describe("organizationOverview counts and roles", () => {
  it("zero-fills counts for missing/malformed snapshots", () => {
    expect(organizationOverviewCounts(overview())).toEqual({ members: 5, projects: 3 });
    expect(organizationOverviewCounts(undefined)).toEqual({ members: 0, projects: 0 });
    expect(organizationOverviewCounts(overview({ counts: { members: -4, projects: 2.9 } as never }))).toEqual(
      { members: 0, projects: 2 },
    );
  });

  it("produces a complete zero-filled role breakdown with shares", () => {
    const rows = organizationOverviewRoleRows(overview());
    expect(rows.map((row) => row.role)).toEqual(["owner", "admin", "member", "viewer"]);
    expect(rows.map((row) => row.count)).toEqual([1, 1, 2, 1]);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(5);
    expect(rows.find((row) => row.role === "member")?.label).toBe("Member");
    expect(rows.find((row) => row.role === "member")?.percent).toBe(40);
    expect(rows.find((row) => row.role === "owner")?.tone).toBe("accent");
    expect(organizationOverviewRoleRows(undefined).every((row) => row.count === 0)).toBe(true);
    expect(organizationOverviewRoleRows(undefined).every((row) => row.fraction === 0)).toBe(true);
  });

  it("ignores malformed/extra role buckets", () => {
    const rows = organizationOverviewRoleRows(
      overview({
        by_role: [
          { role: "owner", members: 2 },
          { role: "spectator", members: 9 },
          { role: "member", members: Number.NaN },
        ] as never,
      }),
    );
    expect(rows.find((row) => row.role === "owner")?.count).toBe(2);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  it("counts only roles that hold members", () => {
    expect(organizationOverviewActiveRoleCount(overview())).toBe(4);
    expect(
      organizationOverviewActiveRoleCount(
        overview({ by_role: [{ role: "owner", members: 1 }, { role: "viewer", members: 0 }] }),
      ),
    ).toBe(1);
    expect(organizationOverviewActiveRoleCount(undefined)).toBe(0);
  });

  it("builds four headline stat rows", () => {
    const rows = organizationOverviewStatRows(overview(), NOW);
    expect(rows.map((row) => row.key)).toEqual(["members", "projects", "roles", "created"]);
    expect(rows.find((row) => row.key === "members")?.value).toBe("5");
    expect(rows.find((row) => row.key === "projects")?.value).toBe("3");
    expect(rows.find((row) => row.key === "roles")?.value).toBe("4");
    expect(rows.find((row) => row.key === "created")?.value).toBe("3 hours ago");
    expect(organizationOverviewStatRows(undefined, NOW).find((row) => row.key === "created")?.value).toBe(
      "—",
    );
  });
});

describe("organizationOverview recent rows and summary", () => {
  it("projects recent members into render-safe rows", () => {
    const rows = organizationOverviewRecentMembers(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: "user-1",
      label: "Ada Lovelace",
      email: "ada@example.com",
      roleLabel: "Owner",
      roleTone: "accent",
      joinedLabel: "2 hours ago",
    });
    expect(rows[1]?.label).toBe("grace@example.com");
    expect(rows[1]?.roleLabel).toBe("Viewer");
    expect(organizationOverviewRecentMembers(undefined)).toEqual([]);
  });

  it("derives project lifecycle and recency labels", () => {
    expect(organizationOverviewLifecycle({ archived: false } as never)).toEqual({
      label: "Active",
      tone: "success",
    });
    expect(organizationOverviewLifecycle({ archived: true } as never)).toEqual({
      label: "Archived",
      tone: "neutral",
    });
    const rows = organizationOverviewRecentProjects(overview(), NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: "proj-1",
      name: "Short Film",
      lifecycleLabel: "Active",
      createdLabel: "4 hours ago",
      updatedLabel: "30 minutes ago",
    });
    expect(rows[1]?.lifecycleLabel).toBe("Archived");
    expect(organizationOverviewRecentProjects(undefined)).toEqual([]);
  });

  it("detects data presence and formats a one-line summary", () => {
    expect(hasOrganizationOverviewData(overview())).toBe(true);
    expect(hasOrganizationOverviewData(undefined)).toBe(false);
    expect(
      hasOrganizationOverviewData(overview({ counts: { members: 0, projects: 0 }, recent_members: [], recent_projects: [] })),
    ).toBe(false);
    expect(organizationOverviewSummaryLabel(overview())).toBe("5 members · 3 projects");
    expect(organizationOverviewSummaryLabel(overview({ counts: { members: 1, projects: 1 } }))).toBe(
      "1 member · 1 project",
    );
    expect(organizationOverviewSummaryLabel(undefined)).toBe("");
  });
});
