import { describe, expect, it } from "vitest";

import {
  deriveProjectFeed,
  projectFeedQueryParams,
  UNKNOWN_PROJECT_ORG_NAME,
  validateProjectFeedArgs,
} from "./projectFeed";
import type { Organization, Project, ProjectLifecycle } from "./types";

const NOW = "2026-03-18T10:30:00.000Z";
const ORG1 = "0b5c1e2a-0000-4000-8000-000000000001";
const ORG2 = "0b5c1e2a-0000-4000-8000-000000000002";
const P1 = "0b5c1e2a-1000-4000-8000-000000000001";
const P2 = "0b5c1e2a-1000-4000-8000-000000000002";
const P3 = "0b5c1e2a-1000-4000-8000-000000000003";

const ORGANIZATIONS: readonly Organization[] = [
  { id: ORG1, name: "Studio Northlight", slug: "northlight", created_at: NOW },
  { id: ORG2, name: "Second Studio", slug: "second", created_at: NOW },
];

function project(
  id: string,
  orgId: string,
  createdAt: string,
  archived = false,
  overrides: Partial<Project> = {},
): Project {
  return {
    id,
    org_id: orgId,
    name: `Project ${id.slice(-4)}`,
    description: "A seed project.",
    created_by: "user",
    created_at: createdAt,
    updated_at: createdAt,
    archived,
    ...overrides,
  };
}

const PROJECTS: readonly Project[] = [
  project(P1, ORG1, "2026-03-18T08:00:00.000Z"),
  project(P2, ORG1, "2026-03-18T09:00:00.000Z", true, {
    name: "Archived Film",
    description: null,
  }),
  project(P3, ORG2, "2026-03-18T08:00:00.000Z"),
];

describe("deriveProjectFeed", () => {
  it("returns an empty feed when there are no projects", () => {
    expect(deriveProjectFeed([], ORGANIZATIONS, NOW)).toEqual({
      items: [],
      total: 0,
      generated_at: NOW,
    });
  });

  it("orders newest-first with a project-id tie-break and joins org names", () => {
    const feed = deriveProjectFeed([...PROJECTS].reverse(), ORGANIZATIONS, NOW);

    expect(feed.total).toBe(3);
    expect(feed.generated_at).toBe(NOW);
    expect((feed.items ?? []).map((item) => item.project_id)).toEqual([P2, P3, P1]);
    expect((feed.items ?? [])[0]).toMatchObject({
      project_id: P2,
      org_id: ORG1,
      org_name: "Studio Northlight",
      name: "Archived Film",
      description: null,
      lifecycle: "archived",
      created_by: "user",
      created_at: "2026-03-18T09:00:00.000Z",
      updated_at: "2026-03-18T09:00:00.000Z",
    });
    expect((feed.items ?? [])[1]?.lifecycle).toBe("active");
    expect(deriveProjectFeed(PROJECTS, ORGANIZATIONS, NOW)).toEqual(feed);
  });

  it("breaks created-at ties by descending project id", () => {
    const tied = [
      project(P1, ORG1, "2026-03-18T08:00:00.000Z"),
      project(P3, ORG2, "2026-03-18T08:00:00.000Z"),
    ];
    expect(
      deriveProjectFeed(tied, ORGANIZATIONS, NOW).items?.map((item) => item.project_id),
    ).toEqual([P3, P1]);
  });

  it("uses the fallback org name for a project whose organization is missing", () => {
    const orphan = project(P1, "00000000-0000-4000-8000-000000000000", NOW);
    const feed = deriveProjectFeed([orphan], ORGANIZATIONS, NOW);
    expect((feed.items ?? [])[0]?.org_name).toBe(UNKNOWN_PROJECT_ORG_NAME);
  });

  it("scopes to one org and/or lifecycle and counts the whole feed before the limit page", () => {
    const scoped = deriveProjectFeed(PROJECTS, ORGANIZATIONS, NOW, { orgId: ORG1 });
    expect(scoped.total).toBe(2);
    expect((scoped.items ?? []).map((item) => item.project_id)).toEqual([P2, P1]);

    const filtered = deriveProjectFeed(PROJECTS, ORGANIZATIONS, NOW, {
      lifecycle: "archived" as ProjectLifecycle,
    });
    expect(filtered.total).toBe(1);
    expect((filtered.items ?? []).map((item) => item.project_id)).toEqual([P2]);

    const scopedAndFiltered = deriveProjectFeed(PROJECTS, ORGANIZATIONS, NOW, {
      orgId: ORG1,
      lifecycle: "active",
    });
    expect((scopedAndFiltered.items ?? []).map((item) => item.project_id)).toEqual([P1]);

    // An unknown-but-valid org yields a zero-filled feed, never an error.
    const unknownOrg = deriveProjectFeed(PROJECTS, ORGANIZATIONS, NOW, {
      orgId: "00000000-0000-4000-8000-000000000000",
    });
    expect(unknownOrg).toEqual({ items: [], total: 0, generated_at: NOW });

    const paged = deriveProjectFeed(PROJECTS, ORGANIZATIONS, NOW, { limit: 1 });
    expect(paged.total).toBe(3);
    expect((paged.items ?? []).map((item) => item.project_id)).toEqual([P2]);
  });
});

describe("project feed query helpers", () => {
  it("mirrors router validation for a malformed org id, lifecycle or limit", () => {
    expect(() => validateProjectFeedArgs()).not.toThrow();
    expect(() =>
      validateProjectFeedArgs({ orgId: ORG1, lifecycle: "active", limit: 10 }),
    ).not.toThrow();
    for (const bad of [
      { orgId: "not-a-uuid" },
      { lifecycle: "paused" as unknown as ProjectLifecycle },
      { limit: 0 },
      { limit: 201 },
      { limit: 1.5 },
    ]) {
      try {
        validateProjectFeedArgs(bad);
        throw new Error("expected validation to fail");
      } catch (cause) {
        expect(cause).toMatchObject({ status: 422, code: "validation_error" });
      }
    }
  });

  it("maps the scope, filter and page onto the live query string", () => {
    expect(projectFeedQueryParams()).toEqual({
      org_id: undefined,
      lifecycle: undefined,
      limit: undefined,
    });
    expect(
      projectFeedQueryParams({ orgId: ORG1, lifecycle: "archived", limit: 5 }),
    ).toEqual({
      org_id: ORG1,
      lifecycle: "archived",
      limit: 5,
    });
  });
});
