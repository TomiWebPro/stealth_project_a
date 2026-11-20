import { describe, expect, it } from "vitest";

import { REFERENCE_NOW } from "./mock/data";
import type { OrganizationMemberRecord } from "./organizationStats";
import type { Organization, Project } from "./types";
import {
  DEFAULT_ORGANIZATION_OVERVIEW_RECENT_LIMIT,
  deriveOrganizationOverview,
  organizationOverviewQueryParams,
  validateOrganizationOverviewArgs,
} from "./organizationOverview";
import type { OrganizationOverviewSeeds } from "./organizationOverview";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";

function org(id: string, overrides: Partial<Organization> = {}): Organization {
  return {
    id,
    name: `org-${id}`,
    slug: `org-${id}`,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function member(id: string, overrides: Partial<OrganizationMemberRecord> = {}): OrganizationMemberRecord {
  return {
    org_id: ORG_A,
    user_id: id,
    email: `${id}@studio.local`,
    display_name: `Member ${id}`,
    role: "member",
    joined_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    org_id: ORG_A,
    name: `project-${id}`,
    created_by: CREATOR,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function seeds(overrides: Partial<OrganizationOverviewSeeds> = {}): OrganizationOverviewSeeds {
  return {
    organizations: [org(ORG_A)],
    members: [],
    projects: [],
    now: REFERENCE_NOW,
    ...overrides,
  };
}

describe("deriveOrganizationOverview", () => {
  it("zero-fills counts and role buckets for an organization with no members/projects", () => {
    const overview = deriveOrganizationOverview(ORG_A, seeds());
    expect(overview).toEqual({
      org_id: ORG_A,
      name: `org-${ORG_A}`,
      slug: `org-${ORG_A}`,
      created_at: "2026-01-01T00:00:00.000Z",
      counts: { members: 0, projects: 0 },
      by_role: [
        { role: "owner", members: 0 },
        { role: "admin", members: 0 },
        { role: "member", members: 0 },
        { role: "viewer", members: 0 },
      ],
      recent_members: [],
      recent_projects: [],
      generated_at: REFERENCE_NOW,
    });
  });

  it("derives identity, whole-scope counts and a zero-filled role breakdown", () => {
    const overview = deriveOrganizationOverview(
      ORG_A,
      seeds({
        organizations: [org(ORG_A, { name: "Studio Northlight", slug: "studio-northlight" })],
        members: [
          member("m1", { role: "owner" }),
          member("m2", { role: "admin" }),
          member("m3", { role: "member" }),
          member("m4", { role: "member" }),
          member("m5", { role: "viewer", org_id: OTHER_ORG }),
        ],
        projects: [project("p1"), project("p2", { org_id: OTHER_ORG })],
      }),
    );
    expect(overview.name).toBe("Studio Northlight");
    expect(overview.slug).toBe("studio-northlight");
    expect(overview.counts).toEqual({ members: 4, projects: 1 });
    expect(overview.by_role).toEqual([
      { role: "owner", members: 1 },
      { role: "admin", members: 1 },
      { role: "member", members: 2 },
      { role: "viewer", members: 0 },
    ]);
    expect(overview.by_role?.reduce((sum, bucket) => sum + bucket.members, 0)).toBe(
      overview.counts.members,
    );
  });

  it("returns newest-first recent members/projects with deterministic id tie-breaks", () => {
    const overview = deriveOrganizationOverview(
      ORG_A,
      seeds({
        members: [
          member("m1", { joined_at: "2026-01-01T00:00:00.000Z" }),
          member("m2", { joined_at: "2026-01-03T00:00:00.000Z" }),
          member("m3", { joined_at: "2026-01-03T00:00:00.000Z" }),
          member("m4", { joined_at: "2026-01-02T00:00:00.000Z" }),
        ],
        projects: [
          project("p1", { created_at: "2026-01-01T00:00:00.000Z" }),
          project("p2", { created_at: "2026-01-03T00:00:00.000Z" }),
          project("p3", { created_at: "2026-01-03T00:00:00.000Z" }),
        ],
      }),
    );
    expect(overview.recent_members?.map((entry) => entry.user_id)).toEqual(["m3", "m2", "m4", "m1"]);
    expect(overview.recent_projects?.map((entry) => entry.id)).toEqual(["p3", "p2", "p1"]);
    // The mock-only org discriminator must not leak onto the Member wire shape.
    expect(overview.recent_members?.[0]).not.toHaveProperty("org_id");
  });

  it("bounds the recent lists without bounding the whole-scope counts", () => {
    const whole = deriveOrganizationOverview(ORG_A, seeds());
    const limited = deriveOrganizationOverview(
      ORG_A,
      seeds({
        members: [member("m1"), member("m2"), member("m3")],
        projects: [project("p1"), project("p2"), project("p3")],
      }),
      { recentLimit: 1 },
    );
    expect(limited.counts).toEqual({ members: 3, projects: 3 });
    expect(limited.recent_members).toHaveLength(1);
    expect(limited.recent_projects).toHaveLength(1);
    expect(whole.recent_members).toHaveLength(0);
  });

  it("throws a 404 for an unseeded organization", () => {
    expect(() => deriveOrganizationOverview(OTHER_ORG, seeds())).toThrow(
      expect.objectContaining({ status: 404, code: "organization_not_found" }),
    );
  });
});

describe("validateOrganizationOverviewArgs", () => {
  it("accepts a well-formed id and omits an unspecified recent limit", () => {
    expect(() => validateOrganizationOverviewArgs(ORG_A)).not.toThrow();
    expect(() => validateOrganizationOverviewArgs(ORG_A, { recentLimit: 50 })).not.toThrow();
    expect(organizationOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(organizationOverviewQueryParams({ recentLimit: 3 })).toEqual({ recent_limit: 3 });
  });

  it.each([0, 51, -1, 1.5, Number.NaN])("rejects out-of-range recent limit %s", (recentLimit) => {
    expect(() => validateOrganizationOverviewArgs(ORG_A, { recentLimit })).toThrow(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it("rejects a malformed organization id", () => {
    expect(() => validateOrganizationOverviewArgs("not-a-uuid")).toThrow(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it("uses the default recent limit of 5", () => {
    expect(DEFAULT_ORGANIZATION_OVERVIEW_RECENT_LIMIT).toBe(5);
  });
});
