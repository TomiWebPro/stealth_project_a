import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type {
  Comment,
  Conversation,
  Organization,
  Presence,
  Project,
  User,
} from "./types";
import type { OrganizationMemberRecord } from "./organizationStats";
import {
  DEFAULT_USER_OVERVIEW_RECENT_LIMIT,
  deriveUserOverview,
  userOverviewQueryParams,
  validateUserOverviewArgs,
} from "./userOverview";

const USER_ID = "0b5c1e2a-0000-4000-8000-0000000000aa";
const OTHER_ID = "0b5c1e2a-0000-4000-8000-0000000000bb";
const ORG_1 = "0b5c1e2a-1000-4000-8000-000000000001";
const ORG_2 = "0b5c1e2a-1000-4000-8000-000000000002";
const NOW = "2026-03-18T10:30:00.000Z";

function user(id: string, name: string): User {
  return {
    id,
    email: `${id.slice(0, 8)}@studio.local`,
    display_name: name,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function org(id: string, name: string): Organization {
  return { id, name, slug: name.toLowerCase().replace(/\s+/g, "-"), created_at: "2026-01-01T00:00:00.000Z" };
}

function member(
  orgId: string,
  userId: string,
  role: OrganizationMemberRecord["role"],
  joined_at: string,
): OrganizationMemberRecord {
  return {
    org_id: orgId,
    user_id: userId,
    email: `${userId.slice(0, 8)}@studio.local`,
    display_name: "Member",
    role,
    joined_at,
  };
}

function project(id: string, createdBy: string, createdAt: string): Project {
  return {
    id,
    org_id: ORG_1,
    name: `Project ${id.slice(-2)}`,
    created_by: createdBy,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function comment(id: string, author: string, createdAt: string): Comment {
  return {
    id,
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    asset_id: null,
    author_id: author,
    body: `Comment ${id.slice(-2)}`,
    created_at: createdAt,
  };
}

function conversation(id: string, createdBy: string): Conversation {
  return {
    id,
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    title: `Conversation ${id.slice(-2)}`,
    created_by: createdBy,
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
    message_count: 0,
  };
}

function presence(userId: string): Presence {
  return {
    user_id: userId,
    project_id: "0b5c1e2a-1000-4000-8000-000000000001",
    state: "online",
    last_seen_at: NOW,
  };
}

const seeds = {
  users: [user(USER_ID, "Avery Director"), user(OTHER_ID, "Morgan Producer")],
  organizations: [org(ORG_1, "Studio Northlight"), org(ORG_2, "Studio Southlight")],
  members: [
    member(ORG_1, USER_ID, "owner", "2026-01-05T00:00:00.000Z"),
    member(ORG_2, USER_ID, "member", "2026-02-10T00:00:00.000Z"),
    member(ORG_1, OTHER_ID, "admin", "2026-01-06T00:00:00.000Z"),
  ],
  projects: [
    project("0b5c1e2a-3000-4000-8000-000000000001", USER_ID, "2026-03-01T00:00:00.000Z"),
    project("0b5c1e2a-3000-4000-8000-000000000002", USER_ID, "2026-03-10T00:00:00.000Z"),
    project("0b5c1e2a-3000-4000-8000-000000000003", OTHER_ID, "2026-03-11T00:00:00.000Z"),
  ],
  conversations: [
    conversation("0b5c1e2a-5100-4000-8000-000000000001", USER_ID),
    conversation("0b5c1e2a-5100-4000-8000-000000000002", OTHER_ID),
  ],
  comments: [
    comment("0b5c1e2a-6200-4000-8000-000000000001", USER_ID, "2026-03-02T00:00:00.000Z"),
    comment("0b5c1e2a-6200-4000-8000-000000000002", USER_ID, "2026-03-09T00:00:00.000Z"),
    comment("0b5c1e2a-6200-4000-8000-000000000003", OTHER_ID, "2026-03-08T00:00:00.000Z"),
  ],
  presence: [presence(USER_ID), presence(OTHER_ID)],
  now: NOW,
};

describe("deriveUserOverview", () => {
  it("derives identity, memberships and whole-scope counts", () => {
    const overview = deriveUserOverview(USER_ID, seeds);

    expect(overview).toMatchObject({
      user_id: USER_ID,
      email: "0b5c1e2a@studio.local",
      display_name: "Avery Director",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00.000Z",
      counts: {
        organizations: 2,
        projects: 2,
        conversations: 1,
        comments: 2,
        presence: 1,
      },
      generated_at: NOW,
    });
    // Memberships are newest-first by joined_at and never bounded by the page.
    expect(overview.memberships).toEqual([
      { org_id: ORG_2, org_name: "Studio Southlight", role: "member", joined_at: "2026-02-10T00:00:00.000Z" },
      { org_id: ORG_1, org_name: "Studio Northlight", role: "owner", joined_at: "2026-01-05T00:00:00.000Z" },
    ]);
    expect(overview.recent_projects?.map((item) => item.id)).toEqual([
      "0b5c1e2a-3000-4000-8000-000000000002",
      "0b5c1e2a-3000-4000-8000-000000000001",
    ]);
    expect(overview.recent_comments?.map((item) => item.id)).toEqual([
      "0b5c1e2a-6200-4000-8000-000000000002",
      "0b5c1e2a-6200-4000-8000-000000000001",
    ]);
  });

  it("uses a stable fallback for an unknown organization membership", () => {
    const overview = deriveUserOverview(USER_ID, { ...seeds, organizations: [] });
    expect(overview.memberships?.[0]?.org_name).toBe("Unknown organization");
  });

  it("throws a 404 envelope for an unknown user", () => {
    expect(() => deriveUserOverview("00000000-0000-4000-8000-000000000000", seeds)).toThrowError(
      ApiError,
    );
    try {
      deriveUserOverview("00000000-0000-4000-8000-000000000000", seeds);
    } catch (cause) {
      expect(cause).toMatchObject({ status: 404, code: "user_not_found" });
    }
  });

  it("bounds only the recent pages by recentLimit without bounding the counts or memberships", () => {
    const overview = deriveUserOverview(USER_ID, seeds, { recentLimit: 1 });

    expect(overview.recent_projects).toHaveLength(1);
    expect(overview.recent_comments).toHaveLength(1);
    expect(overview.memberships).toHaveLength(2);
    expect(overview.counts.projects).toBe(2);
    expect(overview.counts.comments).toBe(2);
  });
});

describe("validateUserOverviewArgs", () => {
  it("accepts a valid id and the default options", () => {
    expect(() => validateUserOverviewArgs(USER_ID)).not.toThrow();
    expect(() =>
      validateUserOverviewArgs(USER_ID, { recentLimit: DEFAULT_USER_OVERVIEW_RECENT_LIMIT }),
    ).not.toThrow();
  });

  it.each(["not-a-uuid", "oops"])("rejects a malformed user id (%s)", (id) => {
    expect(() => validateUserOverviewArgs(id)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it.each([0, 51, -1, 1.5])("rejects an out-of-range recentLimit (%s)", (recentLimit) => {
    expect(() => validateUserOverviewArgs(USER_ID, { recentLimit })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("userOverviewQueryParams", () => {
  it("maps the recent limit to the live query param", () => {
    expect(userOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(userOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
