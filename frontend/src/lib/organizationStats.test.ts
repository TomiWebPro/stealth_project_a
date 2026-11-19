import { describe, expect, it } from "vitest";

import type { Member, Organization, User } from "./types";
import {
  MEMBER_ROLES,
  deriveOrganizationStats,
  organizationStatsQueryParams,
  validateOrganizationStatsArgs,
} from "./organizationStats";
import type { OrganizationMemberRecord } from "./organizationStats";
import { REFERENCE_NOW } from "./mock/data";

const ORG_A = "0b5c1e2a-0000-4000-8000-00000000000a";
const ORG_B = "0b5c1e2a-0000-4000-8000-00000000000b";

function org(id: string, created_at = "2026-01-01T00:00:00.000Z"): Organization {
  return { id, name: `org-${id}`, slug: `org-${id}`, created_at };
}

function user(id: string): User {
  return {
    id,
    email: `${id}@studio.local`,
    display_name: `user-${id}`,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function member(org_id: string, user_id: string, role: Member["role"]): OrganizationMemberRecord {
  return {
    org_id,
    user_id,
    email: `${user_id}@studio.local`,
    display_name: `user-${user_id}`,
    role,
    joined_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("deriveOrganizationStats", () => {
  it("zero-fills every role and yields null recency for an empty store", () => {
    expect(deriveOrganizationStats([], [], [], REFERENCE_NOW)).toEqual({
      total_organizations: 0,
      total_members: 0,
      total_users: 0,
      by_role: MEMBER_ROLES.map((role) => ({ role, members: 0 })),
      by_organization: [],
      average_members_per_org: 0.0,
      newest_org_at: null,
      generated_at: REFERENCE_NOW,
    });
  });

  it("derives role/per-org breakdowns, global user total, average and recency", () => {
    const stats = deriveOrganizationStats(
      [
        org(ORG_A, "2026-01-01T00:00:00.000Z"),
        org(ORG_B, "2026-01-03T00:00:00.000Z"),
      ],
      [
        member(ORG_A, "u1", "owner"),
        member(ORG_A, "u2", "member"),
        member(ORG_A, "u3", "viewer"),
        member(ORG_B, "u4", "admin"),
      ],
      [user("u1"), user("u2"), user("u3"), user("u4"), user("u5")],
      REFERENCE_NOW,
    );

    expect(stats.total_organizations).toBe(2);
    expect(stats.total_members).toBe(4);
    expect(stats.total_users).toBe(5);
    expect(stats.by_role).toEqual([
      { role: "owner", members: 1 },
      { role: "admin", members: 1 },
      { role: "member", members: 1 },
      { role: "viewer", members: 1 },
    ]);
    // Descending member count then org id.
    expect(stats.by_organization).toEqual([
      { org_id: ORG_A, members: 3 },
      { org_id: ORG_B, members: 1 },
    ]);
    expect(stats.average_members_per_org).toBe(2.0);
    expect(stats.newest_org_at).toBe("2026-01-03T00:00:00.000Z");
  });

  it("rounds the average to three decimals and lists zero-member orgs", () => {
    const stats = deriveOrganizationStats(
      [org(ORG_A), org(ORG_B)],
      [member(ORG_A, "u1", "owner")],
      [user("u1")],
      REFERENCE_NOW,
    );
    expect(stats.average_members_per_org).toBe(0.5);
    expect(stats.by_organization).toEqual([
      { org_id: ORG_A, members: 1 },
      { org_id: ORG_B, members: 0 },
    ]);
    expect(stats.by_role).toEqual([
      { role: "owner", members: 1 },
      { role: "admin", members: 0 },
      { role: "member", members: 0 },
      { role: "viewer", members: 0 },
    ]);
  });

  it("breaks by_organization ordering ties by org id", () => {
    const stats = deriveOrganizationStats(
      [org(ORG_B), org(ORG_A)],
      [member(ORG_A, "u1", "owner"), member(ORG_B, "u2", "owner")],
      [],
      REFERENCE_NOW,
    );
    expect(stats.by_organization).toEqual([
      { org_id: ORG_A, members: 1 },
      { org_id: ORG_B, members: 1 },
    ]);
  });

  it("breaks recency ties by org id like the backend max key", () => {
    const stats = deriveOrganizationStats(
      [org(ORG_A, "2026-01-02T00:00:00.000Z"), org(ORG_B, "2026-01-02T00:00:00.000Z")],
      [],
      [],
      REFERENCE_NOW,
    );
    expect(stats.newest_org_at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("scopes organizations and members to one org while keeping users global", () => {
    const organizations = [org(ORG_A), org(ORG_B)];
    const members = [
      member(ORG_A, "u1", "owner"),
      member(ORG_A, "u2", "member"),
      member(ORG_B, "u3", "admin"),
    ];
    const users = [user("u1"), user("u2"), user("u3"), user("u4")];

    const scoped = deriveOrganizationStats(organizations, members, users, REFERENCE_NOW, {
      orgId: ORG_A,
    });
    expect(scoped.total_organizations).toBe(1);
    expect(scoped.total_members).toBe(2);
    expect(scoped.total_users).toBe(4);
    expect(scoped.by_organization).toEqual([{ org_id: ORG_A, members: 2 }]);

    const all = deriveOrganizationStats(organizations, members, users, REFERENCE_NOW);
    expect(all.total_organizations).toBe(2);
    expect(all.total_members).toBe(3);
    expect(all.total_users).toBe(4);
  });

  it("yields a zero-filled snapshot for an unknown (well-formed) org", () => {
    const stats = deriveOrganizationStats(
      [org(ORG_A)],
      [member(ORG_A, "u1", "owner")],
      [user("u1")],
      REFERENCE_NOW,
      { orgId: "00000000-0000-4000-8000-000000000000" },
    );
    expect(stats.total_organizations).toBe(0);
    expect(stats.total_members).toBe(0);
    expect(stats.total_users).toBe(1);
    expect(stats.by_role).toEqual(MEMBER_ROLES.map((role) => ({ role, members: 0 })));
    expect(stats.by_organization).toEqual([]);
    expect(stats.newest_org_at).toBeNull();
  });
});

describe("validateOrganizationStatsArgs", () => {
  it("rejects a malformed org id with a 422 envelope", () => {
    expect(() => validateOrganizationStatsArgs({ orgId: "not-a-uuid" })).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "validation_error",
        details: [expect.objectContaining({ field: "org_id" })],
      }),
    );
  });

  it("accepts a valid uuid or an omitted scope", () => {
    expect(() => validateOrganizationStatsArgs()).not.toThrow();
    expect(() => validateOrganizationStatsArgs({ orgId: ORG_A })).not.toThrow();
  });
});

describe("organizationStatsQueryParams", () => {
  it("maps the org scope to the authoritative query string", () => {
    expect(organizationStatsQueryParams()).toEqual({ org_id: undefined });
    expect(organizationStatsQueryParams({ orgId: ORG_A })).toEqual({ org_id: ORG_A });
  });
});
