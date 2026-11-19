import { describe, expect, it } from "vitest";

import {
  deriveOrganizationFeed,
  organizationFeedQueryParams,
  validateOrganizationFeedArgs,
} from "./organizationFeed";
import type { OrganizationMemberRecord } from "./organizationStats";
import type { Organization, Project } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const O1 = "0b5c1e2a-1000-4000-8000-000000000001";
const O2 = "0b5c1e2a-1000-4000-8000-000000000002";
const CREATOR = "0b5c1e2a-0000-4000-8000-0000000000aa";

const ORGANIZATIONS: readonly Organization[] = [
  { id: O1, name: "Studio Northlight", slug: "studio-northlight", created_at: "2026-03-01T08:00:00.000Z" },
  { id: O2, name: "Second Studio", slug: "second-studio", created_at: "2026-03-12T08:00:00.000Z" },
];

function member(orgId: string, userIndex: number): OrganizationMemberRecord {
  return {
    org_id: orgId,
    user_id: `0b5c1e2a-0000-4000-8000-0000000000${userIndex.toString(16).padStart(2, "0")}`,
    email: `user${userIndex}@studio.local`,
    display_name: `User ${userIndex}`,
    role: "member",
    joined_at: NOW,
  };
}

function project(id: string, orgId: string): Project {
  return { id, org_id: orgId, name: `project-${id}`, created_by: CREATOR, created_at: NOW, updated_at: NOW };
}

const MEMBERS: readonly OrganizationMemberRecord[] = [
  member(O1, 1),
  member(O1, 2),
  member(O1, 3),
  member(O2, 4),
  // Orphan membership of an unknown org — excluded from every count.
  member("00000000-0000-4000-8000-000000000000", 5),
];

const PROJECTS: readonly Project[] = [
  project("0b5c1e2a-2000-4000-8000-000000000001", O1),
  project("0b5c1e2a-2000-4000-8000-000000000002", O2),
  project("0b5c1e2a-2000-4000-8000-000000000003", O2),
  // Project of an unknown org — excluded from every count.
  project("0b5c1e2a-2000-4000-8000-000000000004", "00000000-0000-4000-8000-000000000000"),
];

describe("deriveOrganizationFeed", () => {
  it("returns an empty feed when there are no organizations", () => {
    expect(deriveOrganizationFeed([], MEMBERS, PROJECTS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with an id tie-break and joins member/project counts", () => {
    const feed = deriveOrganizationFeed([...ORGANIZATIONS].reverse(), MEMBERS, PROJECTS, NOW);

    expect(feed.total).toBe(2);
    expect(feed.generated_at).toBe(NOW);
    expect(feed.items).toEqual([
      {
        org_id: O2,
        name: "Second Studio",
        slug: "second-studio",
        member_count: 1,
        project_count: 2,
        created_at: "2026-03-12T08:00:00.000Z",
      },
      {
        org_id: O1,
        name: "Studio Northlight",
        slug: "studio-northlight",
        member_count: 3,
        project_count: 1,
        created_at: "2026-03-01T08:00:00.000Z",
      },
    ]);
    expect(deriveOrganizationFeed(ORGANIZATIONS, MEMBERS, PROJECTS, NOW)).toEqual(feed);
  });

  it("breaks created-at ties by descending organization id", () => {
    const tied: readonly Organization[] = ORGANIZATIONS.map((org) => ({ ...org, created_at: NOW }));
    expect(deriveOrganizationFeed(tied, MEMBERS, PROJECTS, NOW).items?.map((item) => item.org_id)).toEqual([
      O2,
      O1,
    ]);
  });

  it("counts the whole feed before the limit page", () => {
    const paged = deriveOrganizationFeed(ORGANIZATIONS, MEMBERS, PROJECTS, NOW, { limit: 1 });
    expect(paged.total).toBe(2);
    expect(paged.items).toHaveLength(1);
    expect(paged.items?.[0]?.org_id).toBe(O2);
  });
});

describe("organization feed query helpers", () => {
  it("mirrors router validation for an out-of-range or non-integer limit", () => {
    expect(() => validateOrganizationFeedArgs()).not.toThrow();
    expect(() => validateOrganizationFeedArgs({ limit: 1 })).not.toThrow();
    expect(() => validateOrganizationFeedArgs({ limit: 200 })).not.toThrow();
    for (const bad of [{ limit: 0 }, { limit: 201 }, { limit: 1.5 }]) {
      try {
        validateOrganizationFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the page bound onto the live query string", () => {
    expect(organizationFeedQueryParams()).toEqual({ limit: undefined });
    expect(organizationFeedQueryParams({ limit: 5 })).toEqual({ limit: 5 });
  });
});
