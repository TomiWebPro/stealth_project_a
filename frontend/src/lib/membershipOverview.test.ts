import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import type { OrganizationMemberRecord } from "./organizationStats";
import type {
  Comment,
  Conversation,
  Organization,
  Presence,
  Project,
  User,
} from "./types";
import {
  DEFAULT_MEMBERSHIP_OVERVIEW_RECENT_LIMIT,
  deriveMembershipOverview,
  membershipOverviewQueryParams,
  validateMembershipOverviewArgs,
} from "./membershipOverview";

const ORG_1 = "0b5c1e2a-1000-4000-8000-000000000001";
const ORG_2 = "0b5c1e2a-1000-4000-8000-000000000002";
const USER_ID = "0b5c1e2a-0000-4000-8000-0000000000aa";
const OTHER_ID = "0b5c1e2a-0000-4000-8000-0000000000bb";
const NOW = "2026-03-18T10:30:00.000Z";

function org(id: string, name: string): Organization {
  return { id, name, slug: name.toLowerCase().replace(/\s+/g, "-"), created_at: "2026-01-01T00:00:00.000Z" };
}

function user(id: string, name: string): User {
  return {
    id,
    email: `${id.slice(0, 8)}@studio.local`,
    display_name: name,
    created_at: "2026-01-01T00:00:00.000Z",
  };
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

function project(id: string, orgId: string, createdBy: string, createdAt: string): Project {
  return {
    id,
    org_id: orgId,
    name: `Project ${id.slice(-2)}`,
    created_by: createdBy,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function conversation(id: string, projectId: string, createdBy: string): Conversation {
  return {
    id,
    project_id: projectId,
    title: `Conversation ${id.slice(-2)}`,
    created_by: createdBy,
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
    message_count: 0,
  };
}

function comment(id: string, projectId: string, author: string, createdAt: string): Comment {
  return {
    id,
    project_id: projectId,
    asset_id: null,
    author_id: author,
    body: `Comment ${id.slice(-2)}`,
    created_at: createdAt,
  };
}

function presence(userId: string, projectId: string): Presence {
  return {
    user_id: userId,
    project_id: projectId,
    state: "online",
    last_seen_at: NOW,
  };
}

const PROJECT_1 = "0b5c1e2a-3000-4000-8000-000000000001";
const PROJECT_2 = "0b5c1e2a-3000-4000-8000-000000000002";
const OTHER_ORG_PROJECT = "0b5c1e2a-3000-4000-8000-000000000003";

const seeds = {
  organizations: [org(ORG_1, "Studio Northlight"), org(ORG_2, "Studio Southlight")],
  users: [user(USER_ID, "Avery Director"), user(OTHER_ID, "Morgan Producer")],
  members: [
    member(ORG_1, USER_ID, "owner", "2026-01-05T00:00:00.000Z"),
    member(ORG_1, OTHER_ID, "admin", "2026-01-06T00:00:00.000Z"),
    member(ORG_2, USER_ID, "member", "2026-02-10T00:00:00.000Z"),
  ],
  projects: [
    project(PROJECT_1, ORG_1, USER_ID, "2026-03-01T00:00:00.000Z"),
    project(PROJECT_2, ORG_1, USER_ID, "2026-03-10T00:00:00.000Z"),
    project(OTHER_ORG_PROJECT, ORG_2, USER_ID, "2026-03-11T00:00:00.000Z"),
  ],
  conversations: [
    conversation("0b5c1e2a-5100-4000-8000-000000000001", PROJECT_1, USER_ID),
    conversation("0b5c1e2a-5100-4000-8000-000000000002", OTHER_ORG_PROJECT, USER_ID),
    conversation("0b5c1e2a-5100-4000-8000-000000000003", PROJECT_1, OTHER_ID),
  ],
  comments: [
    comment("0b5c1e2a-6200-4000-8000-000000000001", PROJECT_1, USER_ID, "2026-03-02T00:00:00.000Z"),
    comment("0b5c1e2a-6200-4000-8000-000000000002", PROJECT_2, USER_ID, "2026-03-09T00:00:00.000Z"),
    comment("0b5c1e2a-6200-4000-8000-000000000003", OTHER_ORG_PROJECT, USER_ID, "2026-03-11T00:00:00.000Z"),
    comment("0b5c1e2a-6200-4000-8000-000000000004", PROJECT_1, OTHER_ID, "2026-03-08T00:00:00.000Z"),
  ],
  presence: [
    presence(USER_ID, PROJECT_1),
    presence(USER_ID, OTHER_ORG_PROJECT),
    presence(OTHER_ID, PROJECT_1),
  ],
  now: NOW,
};

describe("deriveMembershipOverview", () => {
  it("derives joined identity, role and org-scoped whole-scope counts", () => {
    const overview = deriveMembershipOverview(ORG_1, USER_ID, seeds);

    expect(overview).toMatchObject({
      org_id: ORG_1,
      org_name: "Studio Northlight",
      org_slug: "studio-northlight",
      user_id: USER_ID,
      email: "0b5c1e2a@studio.local",
      display_name: "Avery Director",
      avatar_url: null,
      role: "owner",
      joined_at: "2026-01-05T00:00:00.000Z",
      counts: { projects: 2, conversations: 1, comments: 2, presence: 1 },
      generated_at: NOW,
    });
  });

  it("breaks ties newest-first by id on the recent pages", () => {
    const overview = deriveMembershipOverview(ORG_1, USER_ID, seeds);
    expect(overview.recent_projects?.map((item) => item.id)).toEqual([PROJECT_2, PROJECT_1]);
    expect(overview.recent_comments?.map((item) => item.id)).toEqual([
      "0b5c1e2a-6200-4000-8000-000000000002",
      "0b5c1e2a-6200-4000-8000-000000000001",
    ]);
  });

  it("bounds only the recent pages by recentLimit without bounding the counts", () => {
    const overview = deriveMembershipOverview(ORG_1, USER_ID, seeds, { recentLimit: 1 });
    expect(overview.recent_projects).toHaveLength(1);
    expect(overview.recent_comments).toHaveLength(1);
    expect(overview.counts).toEqual({ projects: 2, conversations: 1, comments: 2, presence: 1 });
  });

  it("derives the other organization's membership with its own role and scope", () => {
    const overview = deriveMembershipOverview(ORG_2, USER_ID, seeds);
    expect(overview).toMatchObject({
      org_id: ORG_2,
      role: "member",
      joined_at: "2026-02-10T00:00:00.000Z",
      counts: { projects: 1, conversations: 1, comments: 1, presence: 1 },
    });
  });

  it.each([
    ["00000000-0000-4000-8000-000000000000", USER_ID, "organization_not_found"],
    [ORG_1, "00000000-0000-4000-8000-000000000000", "user_not_found"],
    [ORG_2, OTHER_ID, "membership_not_found"],
  ])("throws the matching 404 envelope for a missing org/user/membership (%s, %s)", (orgId, userId, code) => {
    expect(() => deriveMembershipOverview(orgId, userId, seeds)).toThrowError(ApiError);
    try {
      deriveMembershipOverview(orgId, userId, seeds);
    } catch (cause) {
      expect(cause).toMatchObject({ status: 404, code });
    }
  });
});

describe("validateMembershipOverviewArgs", () => {
  it("accepts a valid org/user id and the default options", () => {
    expect(() => validateMembershipOverviewArgs(ORG_1, USER_ID)).not.toThrow();
    expect(() =>
      validateMembershipOverviewArgs(ORG_1, USER_ID, {
        recentLimit: DEFAULT_MEMBERSHIP_OVERVIEW_RECENT_LIMIT,
      }),
    ).not.toThrow();
  });

  it("rejects a malformed org id", () => {
    expect(() => validateMembershipOverviewArgs("nope", USER_ID)).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it("rejects a malformed user id", () => {
    expect(() => validateMembershipOverviewArgs(ORG_1, "nope")).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });

  it.each([0, 51, -1, 1.5])("rejects an out-of-range recentLimit (%s)", (recentLimit) => {
    expect(() => validateMembershipOverviewArgs(ORG_1, USER_ID, { recentLimit })).toThrowError(
      expect.objectContaining({ status: 422, code: "validation_error" }),
    );
  });
});

describe("membershipOverviewQueryParams", () => {
  it("maps the recent limit to the live query param", () => {
    expect(membershipOverviewQueryParams()).toEqual({ recent_limit: undefined });
    expect(membershipOverviewQueryParams({ recentLimit: 2 })).toEqual({ recent_limit: 2 });
  });
});
