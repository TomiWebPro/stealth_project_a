import { describe, expect, it } from "vitest";
import type { OrganizationFeed, OrganizationFeedItem } from "../../lib/types";
import {
  buildOrganizationFeedOptions,
  ORGANIZATION_FEED_LIMITS,
  organizationFeedCountLabel,
  organizationFeedDisplayName,
  organizationFeedEmptyDescription,
  organizationFeedGeneratedAtLabel,
  organizationFeedRows,
  organizationFeedSummary,
  shortOrganizationFeedId,
  type OrganizationFeedRow,
} from "./organizationFeedHelpers";

const NOW = Date.parse("2026-01-01T01:00:00Z");

const firstItem: OrganizationFeedItem = {
  org_id: "org-bbbb-1111",
  name: "Film Studio",
  slug: "film-studio",
  member_count: 4,
  project_count: 2,
  created_at: "2026-01-01T00:45:00Z",
};

const populated: OrganizationFeed = {
  items: [
    firstItem,
    {
      org_id: "org-aaaa-2222",
      name: "R&D Lab",
      slug: "rnd-lab",
      member_count: 1,
      project_count: 0,
      created_at: "2026-01-01T00:30:00Z",
    },
  ],
  total: 7,
  generated_at: "2026-01-01T00:59:30Z",
};

const empty: OrganizationFeed = { items: [], total: 0, generated_at: "2026-01-01T00:00:00Z" };

const soloRow: OrganizationFeedRow = {
  id: "org-solo-0000",
  name: "Solo Studio",
  slug: "solo-studio",
  memberLabel: "1 member",
  projectLabel: "0 projects",
  timestamp: "2026-01-01T00:30:00Z",
  relativeTime: "30 minutes ago",
};

describe("organization feed display helpers", () => {
  it("builds hook options with the bounded page size", () => {
    expect(buildOrganizationFeedOptions(25)).toEqual({ limit: 25 });
    expect(ORGANIZATION_FEED_LIMITS).toEqual([10, 25, 50]);
  });

  it("resolves a display name from the name, slug, then a short id", () => {
    expect(organizationFeedDisplayName({ ...firstItem, name: "  ", slug: "fallback-slug" })).toBe(
      "fallback-slug",
    );
    expect(organizationFeedDisplayName({ ...firstItem, name: "", slug: "  " })).toBe("org-bbbb…");
    expect(shortOrganizationFeedId("tiny")).toBe("tiny");
  });

  it("formats singular, plural and malformed joined counts render-safely", () => {
    expect(organizationFeedCountLabel(1, "member")).toBe("1 member");
    expect(organizationFeedCountLabel(3, "project")).toBe("3 projects");
    expect(organizationFeedCountLabel(Number.NaN, "member")).toBe("0 members");
    expect(organizationFeedCountLabel(-2, "project")).toBe("0 projects");
  });

  it("maps a canonical feed to render-ready rows in wire order", () => {
    const rows = organizationFeedRows(populated, NOW);
    expect(rows.map((row) => row.id)).toEqual(["org-bbbb-1111", "org-aaaa-2222"]);
    expect(rows[0]).toMatchObject({
      name: "Film Studio",
      slug: "film-studio",
      memberLabel: "4 members",
      projectLabel: "2 projects",
      timestamp: "2026-01-01T00:45:00Z",
      relativeTime: "15 minutes ago",
    });
    expect(rows[1]).toMatchObject({
      memberLabel: "1 member",
      projectLabel: "0 projects",
      relativeTime: "30 minutes ago",
    });
  });

  it("returns no rows for a missing, empty or item-less feed", () => {
    expect(organizationFeedRows(undefined, NOW)).toEqual([]);
    expect(organizationFeedRows(empty, NOW)).toEqual([]);
    expect(organizationFeedRows({ ...populated, items: undefined }, NOW)).toEqual([]);
  });

  it("derives the header summary from visible rows and the untruncated total", () => {
    expect(organizationFeedSummary(organizationFeedRows(populated, NOW), 7)).toBe(
      "7 organizations · latest: Film Studio",
    );
    expect(organizationFeedSummary(organizationFeedRows(populated, NOW))).toBe(
      "2 organizations · latest: Film Studio",
    );
    expect(organizationFeedSummary([soloRow], 1)).toBe("1 organization · latest: Solo Studio");
    expect(organizationFeedSummary([], 0)).toBe("No organizations");
  });

  it("formats the generated-at footer and tolerates missing feeds", () => {
    expect(organizationFeedGeneratedAtLabel(populated, NOW)).toBe("30 seconds ago");
    expect(organizationFeedGeneratedAtLabel(empty, NOW)).toBe("1 hour ago");
    expect(organizationFeedGeneratedAtLabel(undefined, NOW)).toBe("");
  });

  it("provides stable empty-state copy", () => {
    expect(organizationFeedEmptyDescription()).toContain("Organizations");
  });

  it("stays render-safe for an organization with missing display names", () => {
    const rows = organizationFeedRows(
      {
        ...populated,
        items: [
          {
            org_id: "org-odd-9999",
            name: "",
            slug: "",
            member_count: Number.POSITIVE_INFINITY,
            project_count: 2.7,
            created_at: "2026-01-01T00:45:00Z",
          },
        ],
      },
      NOW,
    );
    expect(rows[0]).toMatchObject({
      name: "org-odd-…",
      slug: "—",
      memberLabel: "0 members",
      projectLabel: "2 projects",
    });
  });
});
